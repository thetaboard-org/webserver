const Boom = require("@hapi/boom");
const IDS = require("./ids")

const NIFTIES = function (server, options, next) {
    server.route([
            {
                method: 'get',
                path: '/{NFT_ID}/{TOKEN_ID}',
                options: {
                    handler: async (req, h) => {
                        try {
                            const NFT_ID = req.params.NFT_ID;
                            const TOKEN_ID = req.params.TOKEN_ID;
                            let NFT;
                            const [Artist, Drop, Assets, NftTokenId] = [req.getModel('Artist'), req.getModel('Drop'), req.getModel('NFTAsset'), req.getModel('NftTokenIds')]
                            if (NFT_ID === "early_adopter") {
                                NFT = await req.getModel('NFT').findOne({
                                    where: {name: "Thetaboard Early Adopter"},
                                    include: [Artist, Drop, Assets, NftTokenId]
                                });
                            } else {
                                NFT = await req.getModel('NFT').findByPk(NFT_ID, {include: [Artist, Drop, Assets, NftTokenId]});
                            }

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
                handler: async (req, h) => {
                    try {
                        const NFT_ID = req.params.NFT_ID;
                        if (NFT_ID === "early_adopter") {
                            return {
                                "image": "https://nft.thetaboard.io/nft/assets/thetaboard/early_adopter.png",
                                "name": "Thetaboard Early Adopter",
                                "description": "This badge was created for early adopters of the thetaboard community!",
                            }
                        }
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
            method: 'GET',
            path: '/assets/{param*}',
            options: {
                handler: function (req, h) {

                    return h.file(__dirname + "/assets/" + req.params.param, {
                        confine: false
                    });
                },
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
