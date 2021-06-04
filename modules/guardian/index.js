const got = require('got');

// guardian node APIs
const fs = require('fs');
const os = require("os");
const find = require('find-process');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const spawn = require('child_process').spawn;
const rfs = require("rotating-file-stream");
const await_spawn = require('await-spawn');

// set machine id as password of GN so it persists after docker restart.
const theta_mainnet_folder = "/home/node/theta_mainnet";
const guardian_password = "NODE_PASSWORD" in process.env && process.env.NODE_PASSWORD ? process.env.NODE_PASSWORD : "MY_SECRET_NODE_PASSWORD";
const is_public = "PUBLIC" in process.env && process.env.PUBLIC;

const guardian = function (server, options, next) {

    server.route({
        path: '/status',
        method: 'GET',
        handler: async (req, h) => {
            let version = null;
            try {
                try {
                    version = await exec(`${theta_mainnet_folder}/bin/theta version`);

                    version = version.stdout.split('\n');
                } catch (e) {
                }

                const {stdout, stderr} = await exec(`${theta_mainnet_folder}/bin/thetacli query status`);

                const theta_process_pid = await find('name', `${theta_mainnet_folder}/bin/theta`);
                const theta_process_uptime = await exec(`ps -p ${theta_process_pid[0].pid} -o etimes`);
                const uptime = Number(theta_process_uptime.stdout.split('\n')[1]);

                if (stderr) {
                    return h.response({"status": "error", "msg": stderr, "uptime": uptime});
                } else {
                    const status = JSON.parse(stdout);
                    if (status["syncing"]) {
                        return h.response({
                            "status": "syncing",
                            "msg": status,
                            "version": version,
                            "uptime": uptime
                        });
                    } else {
                        return h.response({"status": "ready", "msg": status, "version": version, "uptime": uptime});
                    }
                }
            } catch (e) {
                try {
                    const theta_process = await find('name', `${theta_mainnet_folder}/bin/theta`);
                    if (theta_process.length > 0) {
                        const theta_process_pid = await find('name', `${theta_mainnet_folder}/bin/theta`);
                        const theta_process_uptime = await exec(`ps -p ${theta_process_pid[0].pid} -o etimes`);
                        const uptime = Number(theta_process_uptime.stdout.split('\n')[1]);
                        return h.response({
                            "status": "syncing",
                            "msg": {"process": "process up"},
                            "version": version,
                            "uptime": uptime
                        });
                    } else {
                        return h.response({"status": "error", "msg": e, "version": version, "uptime": 0});
                    }
                } catch (e) {
                    return h.response({"status": "error", "msg": e, "version": version, "uptime": 0});
                }
            }
        }
    });

    server.route({
        path: '/start',
        method: 'GET',
        handler: async (req, h) => {
            try {
                const theta_process = await find('name', `${theta_mainnet_folder}/bin/theta`);
                if (theta_process.length > 0) {
                    return h.response({"error": "Process already started", "success": false});
                } else if (os.totalmem() < 4175540224) {
                    return h.response({"error": "Need at least 4GB of ram", "success": false});
                } else {
                    // TODO: test if snapshot file exists or not. Download if needed
                    const logStream = rfs.createStream("./guardian_logs.log", {
                        size: "1M", // rotate every 1 MegaBytes written
                        interval: "1d", // rotate daily
                        maxFiles: 10,
                        path: "logs"

                    });
                    const job = spawn(`${theta_mainnet_folder}/bin/theta`,
                        ["start", `--config=${theta_mainnet_folder}_mainnet/node`, `--password=${guardian_password}`],
                        {
                            detached: true,// can't run the process detached because of the logs streaming

                        })
                    job.stdout.pipe(logStream);
                    job.stderr.pipe(logStream);
                    job.on('error', (error) => {
                        console.log(error);
                    });
                    return h.response({"error": null, "success": true});
                }
            } catch (e) {
                return h.response({"error": e, "success": false});
            }
        }
    });

    server.route({
        path: '/stop',
        method: 'GET',
        handler: async (req, h) => {
            if (is_public) {
                return h.response({"error": "Not Authorized", "success": false});
            }
            try {
                const theta_process = await find('name', `${theta_mainnet_folder}/bin/theta`);
                if (theta_process.length === 0) {
                    return h.response({"error": "No process found", "success": false});
                } else {
                    theta_process.map((x) => {
                        process.kill(x['pid']);
                    });
                    return h.response({"error": null, "success": true});

                }
            } catch (e) {
                return h.response({"error": e, "success": false});
            }
        }
    });

    server.route({
        path: '/logs',
        method: 'GET',
        handler: async (req, h) => {
            if (fs.existsSync('./logs/guardian_logs.log')) {
                const readStream = fs.createReadStream('./logs/guardian_logs.log');
                return h.response(readStream)
                    .type('text/event-stream; charset=utf-8')
                    .header('Content-Encoding', 'none');
            } else {
                const body = "No logs";
                return h.response(body)
                    .type('text/event-stream; charset=utf-8')
                    .header('Content-Length', Buffer.byteLength(body));
            }

        }
    });

    server.route({
        path: '/summary',
        method: 'GET',
        handler: async (req, h) => {
            try {
                const {stdout, stderr} = await exec(`${theta_mainnet_folder}/bin/thetacli query guardian`);
                if (stderr) {
                    return h.response({"success": false, "msg": stderr});
                } else {
                    const summary = JSON.parse(stdout);
                    return h.response({"success": true, "msg": summary});
                }
            } catch (e) {
                return h.response({"success": false, "msg": e});
            }
        }
    });

    server.route({
        path: '/update',
        method: 'GET',
        handler: async (req, h) => {
            if (is_public) {
                return h.response({"error": "Not Authorized", "success": false});
            }
            try {
                fs.rmSync(`${theta_mainnet_folder}/bin/theta`, {'force': true});
                fs.rmSync(`${theta_mainnet_folder}/bin/thetacli`, {'force': true});
                // get latest urls
                const config = await got(`https://mainnet-data.thetatoken.org/config?is_guardian=true`, {https: {rejectUnauthorized: false}});
                const theta = await got(`https://mainnet-data.thetatoken.org/binary?os=linux&name=theta`, {https: {rejectUnauthorized: false}});
                const thetacli = await got(`https://mainnet-data.thetatoken.org/binary?os=linux&name=thetacli`, {https: {rejectUnauthorized: false}});
                // DLL files
                const wget_config = await_spawn(`wget`, [`--no-check-certificate`, `-O`, `${theta_mainnet_folder}_mainnet/node/config.yaml`, config.body]);
                const wget_theta = await_spawn(`wget`, [`--no-check-certificate`, `-O`, `${theta_mainnet_folder}/bin/theta`, theta.body]);
                const wget_thetacli = await_spawn(`wget`, [`--no-check-certificate`, `-O`, `${theta_mainnet_folder}/bin/thetacli`, thetacli.body]);
                // put correct auth
                await_spawn(`chmod`, [`+x`, `${theta_mainnet_folder}/bin/thetacli`]);
                await_spawn(`chmod`, [`+x`, `${theta_mainnet_folder}/bin/theta`]);
                return h.response({"error": null, "success": true});
            } catch (e) {
                return h.response({"error": e, "success": false});
            }
        }
    });

    server.route({
        path: '/latest_snapshot',
        method: 'GET',
        handler: async (req, h) => {
            if (is_public) {
                return h.response({"error": "Not Authorized", "success": false});
            }
            try {
                const {birthtime} = fs.statSync(`${theta_mainnet_folder}_mainnet/node/snapshot`, {'force': true});
                return h.response({"success": true, "date": birthtime})
            } catch (e) {
                return h.response({"success": false, "error": e});
            }
        }
    });

    server.route({
        path: '/download_snapshot',
        method: 'GET',
        handler: async (req, h) => {
            if (is_public) {
                return h.response({"error": "Not Authorized", "success": false});
            }
            try {
                const theta_process = await find('name', `${theta_mainnet_folder}/bin/theta`);
                if (theta_process.length > 0) {
                    return h.response({"msg": "Process is running", "success": false});
                } else {
                    fs.rmdirSync(`${theta_mainnet_folder}_mainnet/node/db`, {recursive: true});
                    fs.rmSync(`${theta_mainnet_folder}_mainnet/node/snapshot`, {'force': true});
                    const snapshot_url = await got(`https://mainnet-data.thetatoken.org/snapshot`, {https: {rejectUnauthorized: false}});
                    const {
                        stdout,
                        stderr
                    } = await exec(`wget ${snapshot_url.body} --spider --server-response 2>&1 | sed -n '/Content-Length/{s/.*: //;p}'`);
                    const wget = spawn(`wget`, [`--no-check-certificate`, `-O`, `${theta_mainnet_folder}_mainnet/node/snapshot`, snapshot_url.body]);
                    return h.response(wget.stdout).write(`{"Content-Length":${stdout.replace('\n', '')}}\n`);

                }
            } catch (e) {
                return h.response({"msg": e, "success": false});
            }
        }
    });
}


module.exports = {
    register: guardian,
    name: 'guardian',
    version: '1.0.0'
};