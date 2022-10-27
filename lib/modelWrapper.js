// const Translator = require('../lib/translator');
const fs = require("fs")
const empty = require('is-empty');
const debug = require('debug')('crud')
module.exports = function (models) {
    let preparedModels = {}
    const IMAGE_FIELDS = ['image']
    const FILE_FIELDS = ['file']
    const IMAGE_FOLDER = 'uploads'
    const FILE_FOLDER = 'uploads/files'
    for (const [key, value] of Object.entries(models)) {
        let model = models[key]
        preparedModels[key] = {
            name: key,
            create: function (query, data, cb) {
                debug('CRUD create')
                model.create(
                    data
                ).then((res) => {
                    cb(null, res);
                })
            },
            delete: function (id, query, cb) {
                debug('CRUD delete')
                model.destroy({
                    where: {
                        id
                    }
                }).then((res) => {
                    cb(null, res);
                })
            },
            read: function (req, cb) {
                debug('CRUD read')
                let query = req.query
                let modelFields = []
                for (let key in model.rawAttributes) {
                    modelFields.push(key)
                }
                // check if query with fields example ?id=1
                let hasFieldInQuery = false
                let queryObject = {}
                for (let key in query) {
                    if (~modelFields.indexOf(key)) {
                        queryObject[key] = query[key]
                        hasFieldInQuery = true;
                    }
                }

                if (hasFieldInQuery) {
                    model.findAndCountAll({
                        where: queryObject,
                        raw: false
                    }).then((res) => {
                        cb(null, res);
                    })
                } else {
                    const { _end, _order, _sort, _start } = query
                    model.findAndCountAll({
                        offset: _start,
                        limit: _end,
                        order: [
                            [_sort, _order]
                        ],
                        raw: false
                    }).then((res) => {
                        cb(null, { count: res.count, rows: res.rows })
                    })
                }
            },
            readById: function (id, query, req, cb) {
                debug('CRUD readById')
                let start = Date.now()
                // const t = new Translator(req.get('Accept-Language'), model.name, id)

                model.findByPk(id).then((res) => {
                    cb(null, res);
                    // t.translate(res).then((r) => {
                    //     cb(null, r);
                    // })

                })
            },
            update: function (id, query, req, data, cb) {
                debug('CRUD update')
                for (let i in IMAGE_FIELDS) {
                    const imageField = IMAGE_FIELDS[i]
                    if (~Object.keys(data).indexOf(imageField)) {
                        if (!empty(data[imageField]) && typeof data[imageField] === 'object') {
                            debug('has uploadedimage')
                            try {
                                var matches = data[imageField].base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                                if (matches.length !== 3) {
                                    return new Error('Invalid input string');
                                }
                                // TODO DELETE BY LANGUAGE
                                // model.findOne({ where: { id } }).then((res) => {
                                //     debug(res)
                                //     try {
                                //         if (!empty(res[imageField])) {
                                //             debug(`./${IMAGE_FOLDER}/${res[imageField]}`)
                                //             fs.unlinkSync(`./${IMAGE_FOLDER}/${res[imageField]}`)
                                //         }
                                //     } catch (err) {
                                //         debug(err)
                                //     }
                                // })
                                const fileType = matches[1].split('/')[1]
                                const fileBase = matches[2]
                                const fileName = `${data[imageField].newName}.${fileType}`
                                fs.writeFile(`./${IMAGE_FOLDER}/${fileName}`, fileBase, 'base64', function (err) {
                                    if (err) debug(err);
                                });
                                delete data[imageField]
                                debug('uploadedimageurl: ' + fileName)
                                data[imageField] = fileName
                            } catch (error) {
                                debug(error)
                                //return new Error('Invalid image string');
                            }

                        } else {
                            delete data[imageField]
                        }

                    }
                }
                for (const i in FILE_FIELDS) {
                    const fileField = FILE_FIELDS[i]
                    if (~Object.keys(data).indexOf(fileField)) {
                        if (!empty(data[fileField]) && typeof data[fileField] === 'object') {
                            debug('has uploadedFile')
                            try {
                                for (const j in data[fileField]) {
                                    const file = data[fileField][j]
                                    var matches = file.base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                                    if (matches.length !== 3) {
                                        return new Error('Invalid input string');
                                    }
                                    const fileType = matches[1].split('/')[1]
                                    const fileBase = matches[2]
                                    const fileName = `${new Date().getTime()}-${file.title}`
                                    fs.writeFile(`./${FILE_FOLDER}/${fileName}`, fileBase, 'base64', function (err) {
                                        if (err) debug(err);
                                    });
                                    delete data[fileField][j]
                                    debug('uploadedFileurl: ' + fileName)
                                    data[fileField][j] = fileName
                                }

                            } catch (error) {
                                debug(error)
                            }

                        } else {
                            delete data[fileField]
                        }

                    }
                }
                model.findByPk(id).then((res) => {
                    cb(null, res);
                })
                // Translator.update({ req, table: model.name, docId: id, data }).then((r) => {
                //     model.update(r, {
                //         where: {
                //             id
                //         }
                //     }).then(() => {
                //         model.findByPk(id).then((res) => {
                //             cb(null, res);
                //         })
                //     })
                // })
            }
        }
    }
    return preparedModels
}