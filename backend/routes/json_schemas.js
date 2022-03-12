var express = require('express');
var router = express.Router();

const dslParser = require('../grammars/datagen_dsl/parser')
const jsonParser = require('../grammars/json_schema/parser')

const dslConverter = require('../grammars/datagen_dsl/conversions')
const jsonConverter = require('../grammars/json_schema/converter');

// POST para gerar um dataset a partir de um XML schema
router.post('/', (req, res) => {
  try {
    // extrair dados da schema
    let data = jsonParser.parse(req.body.json)
    //console.log(JSON.stringify(data))
    console.log('schema parsed')

    // criar modelo DSL a partir dos dados da schemas
    let model = jsonConverter.convert(data)
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
    res.status(404).jsonp(err)
  }
});

module.exports = router;
