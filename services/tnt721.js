const {ethers} = require("ethers");
const nft_abi = require("../abi/nft_abi.json");
const {URL} = require("url");
const provider = new ethers.providers.JsonRpcProvider("http://142.44.213.241:18888/rpc");
const IMG_EXTENSIONS = ["ase", "art", "bmp", "blp", "cd5", "cit", "cpt", "cr2", "cut", "dds", "dib", "djvu", "egt", "exif", "gif", "gpl", "grf", "icns", "ico", "iff", "jng", "jpeg", "jpg", "jfif", "jp2", "jps", "lbm", "max", "miff", "mng", "msp", "nitf", "ota", "pbm", "pc1", "pc2", "pc3", "pcf", "pcx", "pdn", "pgm", "PI1", "PI2", "PI3", "pict", "pct", "pnm", "pns", "ppm", "psb", "psd", "pdd", "psp", "px", "pxm", "pxr", "qfx", "raw", "rle", "sct", "sgi", "rgb", "int", "bw", "tga", "tiff", "tif", "vtf", "xbm", "xcf", "xpm", "3dv", "amf", "ai", "awg", "cgm", "cdr", "cmx", "dxf", "e2d", "egt", "eps", "fs", "gbr", "odg", "svg", "stl", "vrml", "x3d", "sxd", "v2d", "vnd", "wmf", "emf", "art", "xar", "png", "webp", "jxr", "hdp", "wdp", "cur", "ecw", "iff", "lbm", "liff", "nrrd", "pam", "pcx", "pgf", "sgi", "rgb", "rgba", "bw", "int", "inta", "sid", "ras", "sun", "tga"];


class tnt721 {
    server;

    constructor(server) {
        this.server = server;
    }

    async get_tns_info(contract_addr, token_id) {
        const sequelize = this.server.plugins["hapi-sequelizejs"].thetaboard;

        const NFT = await sequelize.getModel('NFT').findOne({
            where: {nftContractId: contract_addr},
            include: ['Artist']
        });
        let artist;
        if (NFT) {
            artist = NFT ? NFT.Artist.toJSON().attributes : null;
            artist["id"] = NFT.Artist.id;
        }

        const TNT721 = {
            "contract_addr": contract_addr.toLowerCase(),
            "original_token_id": token_id,
            "image": "/assets/nft/tns_placeholder.png",
            "name": null,
            "description": "TNS, Theta name service domain",
            "properties": {
                "artist": artist,
                "drop": null,
                "assets": [],
                "selling_info": null,
                "offers": [],
            },
            "attributes": null,
            "token_id": null,
        }
        try {
            const tnsTokenId = await sequelize.getModel('TnsTokenId').findOne({where: {'tokenId': token_id}});
            TNT721.name = tnsTokenId ? `${tnsTokenId.name}.theta` : token_id;
            return TNT721;
        } catch (e) {
            console.log("Could not fetch TNS");
            console.error(e);
            return null;
        }
    }

    async get_info(contract_addr, token_id) {
        const contract = new ethers.Contract(contract_addr, nft_abi, provider);
        let token_uri = await contract.tokenURI(token_id);
        const parsed = new URL(token_uri);
        const sequelize = this.server.plugins["hapi-sequelizejs"].thetaboard;
        if (token_uri.includes('thetaboard') && process.env.NODE_ENV === 'development') {
            token_uri = token_uri.replace('https://nft.thetaboard.io', 'http://localhost:8000')
        }
        const TNT721 = {
            "contract_addr": contract_addr.toLowerCase(),
            "original_token_id": token_id,
            "image": null,
            "name": null,
            "description": null,
            "properties": {
                "artist": null,
                "drop": null,
                "assets": [],
                "selling_info": null,
                "offers": []
            },
            "attributes": null,
            "token_id": null
        };

        // if it is an image, then we don't have anything else to fetch
        const extension = parsed.pathname.split('.').pop();
        if (IMG_EXTENSIONS.includes(extension)) {
            TNT721['image'] = token_uri;
            TNT721['name'] = `${await contract.name()}`;
        } else {
            try {
                if (parsed.protocol === 'ipfs:') {
                    token_uri = `https://ipfs.io/${token_uri.replace(':/', '')}`
                }
                const nft_metadata_api = await fetch(token_uri);
                const nft_metadata = await nft_metadata_api.json();

                const image_parsed = new URL(nft_metadata['image']);
                if (image_parsed.protocol === 'ipfs:') {
                    nft_metadata['image'] = `https://ipfs.io/${nft_metadata['image'].replace(':/', '')}`
                }
                TNT721['image'] = nft_metadata['image'];
                if (nft_metadata.token_id && !nft_metadata['name'].includes("#")) {
                    TNT721['name'] = `${nft_metadata['name']} #${nft_metadata.token_id}`;
                } else {
                    TNT721['name'] = nft_metadata['name'];
                }
                TNT721.description = nft_metadata.description;
                if (nft_metadata.properties) {
                    TNT721.properties.artist = nft_metadata.properties.artist;
                    TNT721.properties.drop = nft_metadata.properties.drop;
                    TNT721.properties.assets = nft_metadata.properties.assets;
                }
                // if we didn't got the artist info form the web, we try to get it from our DB
                if (!TNT721.properties.artist) {
                    const NFT = await sequelize.getModel('NFT').findOne({
                        where: {nftContractId: contract_addr},
                        include: ['Artist']
                    });
                    if (NFT) {
                        const artist = NFT ? NFT.Artist.toJSON().attributes : null;
                        artist["id"] = NFT.Artist.id;
                        TNT721.properties.artist = artist;
                    }
                }

                if (nft_metadata.attributes) {
                    TNT721.attributes = nft_metadata.attributes;
                }
                // handle thetadrop unique features....
                if (nft_metadata.animation_url) {
                    TNT721.properties.assets = TNT721.properties.assets || [];
                    TNT721.properties.assets.push({
                        description: null,
                        name: null,
                        type: 'video',
                        asset: nft_metadata.animation_url
                    });
                }
                if (nft_metadata.token_id) {
                    TNT721.token_id = nft_metadata.token_id
                } else if (nft_metadata['name'].includes("#")) {
                    try {
                        const number = nft_metadata['name'].split('#');
                        TNT721.token_id = Number(number[1]);
                    } catch (e) {
                        //    couldn't get token id
                    }
                }
            } catch (e) {
                console.log("Could not fetch NFT");
                console.error(e);
                // URL is invalid. Nothing we can do about it...
                return null;
            }
        }
        return TNT721;
    }
}


module.exports = tnt721;