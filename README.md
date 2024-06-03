# Schema Analyser

This is a small CLI tool for parsing your MongoDB document schema and using it for analysis or bulk-seeding.

There are two different schema analysers, both of which use the same underlying code, but the purposes are different. 

1. The schema_analyser.js file generates a JSON which can be used for basic type analysis and identifying the complex data structures for your collections.

2. The schema_analyser_for_datagen.js generates a JSON schema file which is compatible for using with the mgodatagen utility (https://github.com/feliixx/mgodatagen) for generating pseudo-random documents for seeding in your MongoDB deployments.

## Installation

Firstly, please make sure Node.js is installed in your machine (see here for [Node.js installation](https://nodejs.org/en/download/package-manager))

```bash
git clone https://github.com/doshisahil95/schema_analyser.git
cd schema_analyser
npm i
```

## Usage

There are multiple arguments that are common for both the utilities which are outlined below. The ones which are specific to either utility are outlined in their respective sections.

```
--uri                        Pass a connection string to the analyser. This is a required field.
--sampleSize                 Sample size to analyse documents in collection. Default is 1000. Optional
--includeNamespace           Pass an array of namespaces that you want to include for the analysis. Optional.
--exludeNamespace            Pass an array of namespaces that you want to exclude for the analysis. Optional.
```
Example:

```bash
node schema_analyser.js --uri="<<sample connection string>>" --includeNamespace='["database1.collection1", "database2.collection2"]'
```

### schema_analyser_for_datagen.js

```
--startDate                  A start date for all date fields. Must in the format of a string like "yyyy-MM-ddThh:mm:ss+00:00". Optional
--endDate                    An end date for all date fields. Must in the format of a string like "yyyy-MM-ddThh:mm:ss+00:00". Optional
--minIntValue                An maximum integer value for all integer fields. Optional
--maxIntValue                An minimum integer value for all integer fields. Optional
--minStringLength            An minimum string length for all string fields. Optional
--maxStringLength            An maximum string length for all string fields. Optional
--minArrayLength             An minimum array length for all array fields. Optional
--maxArrayLength             An minimum array length for all array fields. Optional
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.
