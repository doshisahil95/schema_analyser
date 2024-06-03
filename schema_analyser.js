//DEPENDENCIES
const mongodbSchema = require('mongodb-schema');
const { MongoClient } = require('mongodb');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs')

// CONTROL PARAMETERS
const fileName = new Date().toISOString() + ".json";
const maxCollectionCount = 20;
const maxSampleSize = 1000;

if (!argv.connectionString) {
    console.log("Invalid Connection String. Exiting now..");
    return;
}

const client = new MongoClient(argv.connectionString, function (err) {
    if (err) {
        throw err
    }
})

async function run() {
    try {
        var sampleSize;
        var includeNamespace = [];
        var excludeNamespace = [];
        var documentStream;
        var finalArr = [];
        var namespaceSet = [];
        var finalNamespace = []

        if (!argv.sampleSize) {
            console.log("Sample Size not defined. Using default sample size..");
            sampleSize = maxSampleSize;
        } else {
            sampleSize = argv.sampleSize
        }

        if (argv.includeNamespace && argv.excludeNamespace) {
            console.log("--includeNamespace & --excludeNamespace not supported when combined. Please remove either one..")
            return;
        }

        if (!argv.includeNamespace) {
            console.log("Namespaces to include not defined. Sampling all namespaces..");
            includeNamespace = [];
        } else {
            includeNamespace = JSON.parse(argv.includeNamespace)
        }

        if (!argv.excludeNamespace) {
            console.log("Namespaces to exclude not defined. Sampling all namespaces..");
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
                if (collections.length > maxCollectionCount) {
                    console.log(dbs.databases[singleDB].name + " has more than " + maxCollectionCount + " collections. Please provide --includeNamespace or --excludeNamespace parameter for the same. Skipping collection to avoid performance issue.");
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

                const result = await mongodbSchema.default(documentStream);
                const simplified = [];

                for (const field of loopThroughFields(result.fields)) {
                    for (let i = 0; i < field.types.length; i++) {
                        var obj = {
                            path: changePath(field.types[i].path),
                            probability: (field.types[i].probability * 100) + '%',
                            fieldType: field.types[i].name,
                        }
                        simplified.push(obj)
                    }
                }
                var finalObj = {
                    databaseName: finalNamespace[singleNamespace].database,
                    collectionName: finalNamespace[singleNamespace].collection,
                    analysis: simplified,
                }
                finalArr.push(finalObj)
            }
        }

        if (fs.existsSync(process.cwd() + "/" + fileName)) {
            fs.unlink(process.cwd() + "/" + fileName, (err) => {
                throw err;
            })
        } else {
            fs.appendFile(fileName, JSON.stringify(finalArr), () => console.log("Schema Analysis written to JSON file at path: " + process.cwd() + "/" + fileName))
        }
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

function changePath(path) {
    return (path.toString()).replaceAll(",", ".");
}

function* loopThroughFields(fieldArr) {
    for (const field of fieldArr) {
        yield field;
        for (const type of field.types) {
            if (type.name == 'Document') {
                yield* loopThroughFields(type.fields)
            }
        }
    }
}

run();