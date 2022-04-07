var express = require('express');
var router = express.Router();

const dslParser = require('../grammars/datagen_dsl/parser')
const jsonParser = require('../grammars/json_schema/parser')

const dslConverter = require('../grammars/datagen_dsl/conversions')
const jsonConverter = require('../grammars/json_schema/converter/converter')

const {resolve_refs} = require('../grammars/json_schema/converter/refs')

// POST para gerar um dataset a partir de um XML schema
router.post('/', (req, res) => {
  try {
    let schemas = req.body.json.split("\n\n\n")

    // extrair dados da schema
    let data = schemas.map(x => jsonParser.parse(x))
    //console.log(JSON.stringify(data))
    console.log('schema parsed')
    
    let resolved = resolve_refs(data, req.body.settings)
    if (resolved !== true) return res.status(201).jsonp({message: resolved})
    if ("$defs" in data[0].schema) delete data[0].schema.$defs

    // criar modelo DSL a partir dos dados da schemas
    let model = jsonConverter.convert(data[0].schema)
    console.log('modelo criado')
    //console.log(model)
    // gerar dataset
    
    let dataset = dslParser.parse(model)
    let format = req.body.settings.OUTPUT
    console.log('dataset gerado')

    // converter dataset para o formato final
    if (format == "JSON") dataset = JSON.stringify(dslConverter.cleanJson(dataset.dataModel.data), null, 2)
    if (format == "XML") dataset = dslConverter.jsonToXml(dataset.dataModel.data, data.xml_declaration)
    console.log('dataset convertido')

    res.status(201).jsonp({dataset})
  } catch (err) {
    res.status(201).jsonp(err)
  }
});

module.exports = router;
