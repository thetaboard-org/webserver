const Boom = require("@hapi/boom");
const fs = require("fs");
const crypto = require("crypto");
const path = require('path');

// img hash packages and config
const Jimp = require('jimp');
const JPEG = require('jpeg-js')
Jimp.decoders['image/jpeg'] = (data) => JPEG.decode(data, {
    maxMemoryUsageInMB: 6144,
})

// video hash packages and config
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const ffprobe = require('@ffprobe-installer/ffprobe');
const videoHash = require('video-hash')({
    ffmpegPath: ffmpeg.path,
    ffprobePath: ffprobe.path,
    strength: 0.1
});

const NIFTIES = function (server, options, next) {
    server.route([
            {
                method: 'get',
                path: '/{NFT_ID}/{TOKEN_ID}',
                options: {
                    cors: true,
                    handler: async (req, h) => {
                        try {
                            let NFT_ID = req.params.NFT_ID;
                            const TOKEN_ID = req.params.TOKEN_ID;
                            let NFT;
                            if (NFT_ID === "thetaboard-first") {
                                NFT_ID = 1
                            }
                            NFT = await req.getModel('NFT').findByPk(NFT_ID,
                                {
                                    include: ['Artist', 'Drop', 'NFTAsset', 'NftTokenId']
                                });

                            return NFT.toERC721(TOKEN_ID);
                        } catch (e) {
                            if (e && e.errors) {
                                e = e.errors[0].message;
                            }
                            return Boom.badRequest(e);
                        }
                    }
                },
            },
            {
                method: 'get',
                path: '/{NFT_ID}',
                options: {
                    cors: true,
                    handler: async (req, h) => {
                        try {
                            const NFT_ID = req.params.NFT_ID;
                            let NFT;
                            const [Artist, Drop, Assets, NftTokenId] = [req.getModel('Artist'), req.getModel('Drop'), req.getModel('NFTAsset'), req.getModel('NftTokenIds')]
                            if (NFT_ID === "thetaboard-first") {
                                NFT = await req.getModel('NFT').findOne({
                                    where: {name: "Thetaboard Early Adopter"},
                                    include: [Artist, Drop, Assets, NftTokenId]
                                });
                            } else {
                                NFT = await req.getModel('NFT').findByPk(NFT_ID, {include: [Artist, Drop, Assets, NftTokenId]});
                            }

                            return NFT.toERC721();
                        } catch (e) {
                            if (e && e.errors) {
                                e = e.errors[0].message;
                            }
                            return Boom.badRequest(e);
                        }
                    }
                }
            },
            {
                method: "POST",
                path: '/assets/upload',
                options: {
                    payload: {
                        output: 'stream',
                        parse: true,
                        allow: 'multipart/form-data',
                        multipart: true,
                        maxBytes: 1048576 * 100 //100 mb
                    },
                    handler: async (req, res) => {
                        const data = req.payload;
                        if (data.file) {
                            let name;
                            let uploadPath = '';
                            const filename = data.file.hapi.filename;
                            if (filename.includes('/')) {
                                const split = filename.split('/');
                                uploadPath = split.slice(0, -1).join('/') + '/';
                            }
                            name = crypto.randomBytes(20).toString('hex') + path.extname(filename);
                            const relativePath = `/assets/${uploadPath}${name}`
                            const filepath = `${__dirname}${relativePath}`;


                            async function saveFile() {
                                const file = fs.createWriteStream(filepath);
                                return new Promise((resolve, reject) => {
                                    file.on('error', (err) => {
                                        reject(err);
                                    });

                                    data.file.pipe(file);

                                    data.file.on('end', async (err) => {
                                        // rename image/video with an image hash name to prevent duplicates
                                        let nameHash;
                                        if (data.file.hapi.headers["content-type"].includes('video')) {
                                            nameHash = await videoHash.video(filepath).hash();
                                        } else {
                                            const img = await Jimp.read(filepath);
                                            nameHash = img.hash();
                                        }
                                        const newPath = filepath.replace(name, nameHash + path.extname(filename));
                                        const newRelativePath = relativePath.replace(name, nameHash + path.extname(filename));
                                        fs.renameSync(filepath, newPath)
                                        const ret = {
                                            fileUrl: `${req.headers.origin}/nft${newRelativePath}`,
                                            headers: data.file.hapi.headers,
                                            success: true
                                        }
                                        return resolve(ret);
                                    });
                                })
                            }

                            try {
                                return await saveFile();
                            } catch (e) {
                                Boom.badRequest(e);
                            }
                        } else {
                            return Boom.badRequest("No file supplied");
                        }
                    }
                }
            },
            {
                method: 'GET',
                path: '/assets/{param*}',
                options: {
                    handler: function
                        (req, h) {

                        return h.file(__dirname + "/assets/" + req.params.param, {
                            confine: false
                        });
                    }
                    ,
                }
            }
        ]
    )
}


module.exports = {
    register: NIFTIES,
    name: 'nifties',
    version: '1.0.0'
};
