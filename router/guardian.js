const express = require('express');
const got = require('got');

const router = express.Router();

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

router.get('/status', async (req, res) => {
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
            res.json({"status": "error", "msg": stderr, "uptime": uptime});
        } else {
            const status = JSON.parse(stdout);
            if (status["syncing"]) {
                res.json({
                    "status": "syncing",
                    "msg": status,
                    "version": version,
                    "uptime": uptime
                });
            } else {
                res.json({"status": "ready", "msg": status, "version": version, "uptime": uptime});
            }
        }
    } catch (e) {
        try {
            const theta_process = await find('name', `${theta_mainnet_folder}/bin/theta`);
            if (theta_process.length > 0) {
                const theta_process_pid = await find('name', `${theta_mainnet_folder}/bin/theta`);
                const theta_process_uptime = await exec(`ps -p ${theta_process_pid[0].pid} -o etimes`);
                const uptime = Number(theta_process_uptime.stdout.split('\n')[1]);
                res.json({
                    "status": "syncing",
                    "msg": {"process": "process up"},
                    "version": version,
                    "uptime": uptime
                });
            } else {
                res.json({"status": "error", "msg": e, "version": version, "uptime": 0});
            }
        } catch (e) {
            res.json({"status": "error", "msg": e, "version": version, "uptime": 0});
        }
    }
});

router.get('/start', async (req, res) => {
    try {
        const theta_process = await find('name', `${theta_mainnet_folder}/bin/theta`);
        if (theta_process.length > 0) {
            res.json({"error": "Process already started", "success": false});
        } else if (os.totalmem() < 4175540224) {
            res.json({"error": "Need at least 4GB of ram", "success": false});
        } else {
            // TODO: test if snapshot file exists or not. Download if needed
            const logStream = rfs.createStream("._logs.log", {
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
            res.json({"error": null, "success": true});
        }
    } catch (e) {
        res.json({"error": e, "success": false});
    }
});

router.get('/stop', async (req, res) => {
    if (is_public) {
        return res.json({"error": "Not Authorized", "success": false});
    }
    try {
        const theta_process = await find('name', `${theta_mainnet_folder}/bin/theta`);
        if (theta_process.length === 0) {
            res.json({"error": "No process found", "success": false});
        } else {
            theta_process.map((x) => {
                process.kill(x['pid']);
            });
            res.json({"error": null, "success": true});

        }
    } catch (e) {
        res.json({"error": e, "success": false});
    }
});

router.get('/logs', (req, res) => {
    const readStream = fs.createReadStream('./logs_logs.log');
    readStream.on("error", () => {
        const body = "No logs";
        res.set('Content-Length', Buffer.byteLength(body));
        res.send(body);
    });
    readStream.pipe(res);
});

router.get('/summary', async (req, res) => {
    try {
        const {stdout, stderr} = await exec(`${theta_mainnet_folder}/bin/thetacli query guardian`);
        if (stderr) {
            res.json({"success": false, "msg": stderr});
        } else {
            const summary = JSON.parse(stdout);
            res.json({"success": true, "msg": summary});
        }
    } catch (e) {
        res.json({"success": false, "msg": e});
    }
});

router.get('/update', async (req, res) => {
    if (is_public) {
        return res.json({"error": "Not Authorized", "success": false});
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
        res.json({"error": null, "success": true});
    } catch (e) {
        res.json({"error": e, "success": false});
    }
});

router.get('/latest_snapshot', async (req, res) => {
    if (is_public) {
        return res.json({"error": "Not Authorized", "success": false});
    }
    try {
        const {birthtime} = fs.statSync(`${theta_mainnet_folder}_mainnet/node/snapshot`, {'force': true});
        res.json({"success": true, "date": birthtime})
    } catch (e) {
        res.json({"success": false, "error": e});
    }

})

router.get('/download_snapshot', async (req, res) => {
    if (is_public) {
        return res.json({"error": "Not Authorized", "success": false});
    }
    try {
        const theta_process = await find('name', `${theta_mainnet_folder}/bin/theta`);
        if (theta_process.length > 0) {
            res.json({"msg": "Process is running", "success": false});
        } else {
            fs.rmdirSync(`${theta_mainnet_folder}_mainnet/node/db`, {recursive: true});
            fs.rmSync(`${theta_mainnet_folder}_mainnet/node/snapshot`, {'force': true});
            const snapshot_url = await got(`https://mainnet-data.thetatoken.org/snapshot`, {https: {rejectUnauthorized: false}});

            const {
                stdout,
                stderr
            } = await exec(`wget ${snapshot_url.body} --spider --server-response 2>&1 | sed -n '/Content-Length/{s/.*: //;p}'`);
            const wget = spawn(`wget`, [`--no-check-certificate`, `-O`, `${theta_mainnet_folder}_mainnet/node/snapshot`, snapshot_url.body]);
            res.write(`{"Content-Length":${stdout.replace('\n', '')}}\n`)
            wget.stdout.pipe(res);
            wget.stderr.pipe(res);
        }
    } catch (e) {
        res.json({"msg": e, "success": false});
    }

});


module.exports.router = router;