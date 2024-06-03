// TO BE USED WITH https://github.com/feliixx/mgodatagen

//DEPENDENCIES
const mongodbSchema = require('mongodb-schema');
const { MongoClient } = require('mongodb');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs')

// CONTROL PARAMETERS
const config = {
    startDate: "2000-01-01T00:00:00+00:00",
    endDate: "2100-01-01T00:00:00+00:00",
    maxCollectionCount: 20,
    maxSampleSize: 1000,
    minIntValue: 0,
    maxIntValue: 10,
    minStringLength: 0,
    maxStringLength: 10,
    minArrayLength: 0,
    maxArrayLength: 10
}

if (!argv.connectionString) {
    console.log("Invalid Connection String. Exiting now..");
    return;
}

const client = new MongoClient(argv.connectionString, function (err) {
    if (err) {
        console.log(err);
    }
})

async function run() {
    try {
        var sampleSize, maxIntValue, minIntValue, maxArrayLength, minArrayLength, minStringLength, maxStringLength, startDate, endDate, documentStream, fileName = new Date().toISOString() + ".json";
        var includeNamespace = [], excludeNamespace = [], finalArr = [], namespaceSet = [], finalNamespace = [];

        if (!argv.maxIntValue) {
            console.log("Maximum integer value not defined. Using default maximum integer value..");
            maxIntValue = config.maxIntValue
        } else {
            maxIntValue = argv.maxIntValue
        }

        if (!argv.minIntValue) {
            console.log("Minimum integer value not defined. Using default minimum integer value..");
            minIntValue = config.minIntValue
        } else {
            minIntValue = argv.minIntValue
        }

        if (!argv.maxStringLength) {
            console.log("Maximum string length not defined. Using default maximum string length..");
            maxStringLength = config.maxStringLength
        } else {
            maxStringLength = argv.maxStringLength
        }

        if (!argv.minStringLength) {
            console.log("Minimum string length not defined. Using default minimum string length..");
            minStringLength = config.minStringLength
        } else {
            minStringLength = argv.minStringLength
        }

        if (!argv.maxArrayLength) {
            console.log("Maximum array length not defined. Using default maximum array length ..");
            maxArrayLength = config.maxArrayLength
        } else {
            maxArrayLength = argv.maxArrayLength
        }
        
        if (!argv.minArrayLength) {
            console.log("Minimum array length not defined. Using default minimum array length ..");
            minArrayLength = config.minArrayLength
        } else {
            minArrayLength = argv.minArrayLength
        }

        if (!argv.startDate) {
            console.log("StartDate value not defined. Using default startDate value..");
            startDate = config.startDate
        } else {
            startDate = argv.startDate
        }

        if (!argv.endDate) {
            console.log("EndDate value not defined. Using default endDate value..");
            endDate = config.endDate
        } else {
            endDate = argv.endDate
        }

        if (!argv.sampleSize) {
            console.log("Sample Size not defined. Using default sample size..");
            sampleSize = config.maxSampleSize;
        } else {
            sampleSize = argv.sampleSize
        }

        if (argv.includeNamespace && argv.excludeNamespace) {
            console.log("--includeNamespace & --excludeNamespace not supported when combined. Please remove either one..")
            return;
        }

        if (!argv.includeNamespace) {
            includeNamespace = [];
        } else {
            includeNamespace = JSON.parse(argv.includeNamespace)
        }

        if (!argv.excludeNamespace) {
            excludeNamespace = [];
        } else {
            excludeNamespace = JSON.parse(argv.excludeNamespace)
        }

        const admin = client.db('admin');
        var dbs = await admin.command({ listDatabases: 1 });

        for (var singleDB in dbs.databases) {
            if (dbs.databases[singleDB].name == "admin" || dbs.databases[singleDB].name == "local" || dbs.databases[singleDB].name == "config") {
                console.log("Skipping " + dbs.databases[singleDB].name + " database");
            } else {
                let collections = await client.db(dbs.databases[singleDB].name).listCollections().toArray();
                if (collections.length > config.maxCollectionCount) {
                    console.log(dbs.databases[singleDB].name + " has more than " + config.maxCollectionCount + " collections. Please provide --includeNamespace or --excludeNamespace parameter for the same. Skipping database to avoid performance issues.");
                } else {
                    for (var singleCollection in collections) {
                        namespaceSet.push({
                            database: dbs.databases[singleDB].name,
                            collection: collections[singleCollection].name,
                            collectionType: collections[singleCollection].type
                        })
                    }
                }
            }
        }

        if (includeNamespace.length > 0) {
            finalNamespace = changeNamespaceSet(1, namespaceSet, includeNamespace)
        } else if (excludeNamespace.length > 0) {
            finalNamespace = changeNamespaceSet(0, namespaceSet, excludeNamespace)
        } else {
            finalNamespace = namespaceSet
        }

        for (var singleNamespace in finalNamespace) {
            if (finalNamespace[singleNamespace].collection == "system.views") {
                console.log("Skipping System.View collection ... ")
            } else if (finalNamespace[singleNamespace].collectionType == "view") {
                console.log("Skipping Views ... ")
            } else {
                documentStream = client.db(finalNamespace[singleNamespace].database).collection(finalNamespace[singleNamespace].collection).aggregate([{ $sample: { size: sampleSize } }]);

                var result = await mongodbSchema.default(documentStream);
                var finalAnalysis = {
                    database: finalNamespace[singleNamespace].database,
                    collection: finalNamespace[singleNamespace].collection,
                    count: 0,
                    content: parseAnalysis(result.fields, minIntValue, maxIntValue, minStringLength, maxStringLength, minArrayLength, maxArrayLength, startDate, endDate)
                }
            }

            finalArr.push(finalAnalysis)
        }

        fs.appendFile(fileName, JSON.stringify(finalArr), () => console.log("Schema Analysis written to JSON file at path: " + process.cwd() + "/" + fileName))
    } catch (error) {
        console.log(error)
    } finally {
        await client.close()
    }
}

function changeNamespaceSet(flag, fullNamespace, subset) {
    switch (flag) {
        case 1:
            var finalNamespace = []
            for (var singleNS in subset) {
                var toInclude = subset[singleNS].split(".");
                if (toInclude[1] == "*") {
                    finalNamespace = fullNamespace.filter(function (singleNamespace) {
                        return singleNamespace.database == toInclude[0]
                    })
                }
                if (toInclude[1] != "*") {
                    var collection = fullNamespace.filter(function (singleNamespace) {
                        return singleNamespace.database == toInclude[0] && singleNamespace.collection == toInclude[1]
                    })
                    finalNamespace.push({
                        database: toInclude[0],
                        collection: toInclude[1],
                        collectionType: collection[0].collectionType
                    })
                }
            }
            return finalNamespace
        default:
            for (var singleNS in subset) {
                var toExclude = subset[singleNS].split(".");
                if (toExclude[1] == "*") {
                    var index = 0;
                    while (index != -1) {
                        index = fullNamespace.findIndex(obj => {
                            return obj.database == toExclude[0]
                        });
                        fullNamespace.splice(index, 1)
                    }
                }
                if (toExclude[1] != "*") {
                    var index = 0;
                    while (index != -1) {
                        index = fullNamespace.findIndex(obj => {
                            return obj.database == toExclude[0] && obj.collection == toExclude[1]
                        })
                        fullNamespace.splice(index, 1)
                    }
                }
            }
            return fullNamespace;
    }
}

function parseAnalysis(toParse, minIntValue, maxIntValue, minStringLength, maxStringLength, minArrayLength, maxArrayLength, startDate, endDate) {
    var finalObj = {}
    for (const field of toParse) {
        switch (field.type) {
            case "Document":
                finalObj[field.name] = {
                    type: "object",
                    objectContent: parseAnalysis(field.types[0].fields)
                }
                break;
            case "Array":
                if (field.types[0].types.length == 0) {
                    finalObj[field.name] = {
                        type: "array",
                        arrayContent: {
                            "type": "string"
                        },
                        minLength: minArrayLength,
                        maxLength: maxArrayLength
                    }
                } else if (field.types[0].types[0].name == "Document") {
                    finalObj[field.name] = {
                        type: "array",
                        arrayContent: {
                            type: "object",
                            objectContent: parseAnalysis(field.types[0].types[0].fields)
                        }
                    }
                } else {
                    var arrayContent = {};
                    switch (field.types[0].types[0].name) {
                        case "String":
                            arrayContent = {
                                type: "string",
                                minLength: minStringLength,
                                maxLength: maxStringLength
                            }
                            break;
                        case "Number":
                            arrayContent = {
                                type: "int",
                                min: minIntValue,
                                max: maxIntValue
                            }
                            break;
                        case "Date":
                            arrayContent = {
                                type: "date",
                                startDate: startDate,
                                endDate: endDate
                            }
                            break;
                        case "Boolean":
                            arrayContent = {
                                type: "boolean"
                            }
                            break;
                        case "ObjectId":
                            arrayContent = {
                                type: "objectId"
                            }
                            break;
                        case "Binary":
                            arrayContent = {
                                type: "uuid",
                                format: "binary"
                            }
                            break;
                        case "Long":
                            arrayContent = {
                                type: "long"
                            }
                            break;
                        default:
                            break;
                    }
                    finalObj[field.name] = {
                        type: "array",
                        arrayContent: arrayContent
                    }
                }
                break;
            case "ObjectId":
                finalObj[field.name] = {
                    type: "objectId"
                }
                break;
            case "String":
                finalObj[field.name] = {
                    type: "string",
                    minLength: minStringLength,
                    maxLength: maxStringLength
                }
                break;
            case "Number":
                finalObj[field.name] = {
                    type: "int",
                    min: minIntValue,
                    max: maxIntValue
                }
                break;
            case "Date":
                finalObj[field.name] = {
                    type: "date",
                    startDate: startDate,
                    endDate: endDate
                }
                break;
            case "Boolean":
                finalObj[field.name] = {
                    type: "boolean"
                }
                break;
            case "Binary":
                finalObj[field.name] = {
                    type: "uuid",
                    format: "binary"
                }
                break;
            case "Long":
                finalObj[field.name] = {
                    type: "long",
                }
                break;
            default:
                break;
        }
    }
    return finalObj
}

run();