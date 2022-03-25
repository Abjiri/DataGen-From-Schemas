var express = require('express');
var router = express.Router();

const dslParser = require('../grammars/datagen_dsl/parser')
const jsonParser = require('../grammars/json_schema/parser')

const dslConverter = require('../grammars/datagen_dsl/conversions')
const jsonConverter = require('../grammars/json_schema/converter');

// POST para gerar um dataset a partir de um XML schema
router.post('/', (req, res) => {
  try {
    let schemas = req.body.json.split("\n\n")
    console.log(schemas)

    // extrair dados da schema
    let data = schemas.map(x => jsonParser.parse(x))
    console.log(JSON.stringify(data))
    console.log('schema parsed')

    for (let i = data.length-1; i >= 0; i--) {
      for (let j = 0; j < data[i].subschemas.length; j++) {
        let subschema = data[i].subschemas[j]
        if (subschema.refs.length > 0) resolve_refs(subschema.schema, subschema.schema, subschema.id)
      }
    }
    console.log("--------------------")
    console.log(JSON.stringify(data))

    // criar modelo DSL a partir dos dados da schemas
    let model = jsonConverter.convert(data[0].schema)
    console.log('modelo criado')
    console.log(model)
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

let base_uri = "https://datagen.di.uminho.pt/json-schemas"
let copy = x => JSON.parse(JSON.stringify(x))
let refs = []

function resolve_refs(json, original_json, schema_id) {
  let keys = Array.isArray(json) ? [...Array(json.length).keys()] : Object.keys(json)

  for (let i = 0; i < keys.length; i++) {
    let k = keys[i]

    if (k == "$ref") {
      let schema
      if (json[k].startsWith(base_uri)) json[k] = json[k].replace(base_uri, "")
      if (schema_id.length > 0 && json[k].startsWith(schema_id)) json[k] = json[k].replace(schema_id, "#")

      if (json[k] == "#" || json[k] == schema_id) {}
      else if (/^#\//.test(json[k])) schema = getLocalRef(json[k].split("/"), copy(original_json))
      else schema = getForeignRef(json[k].split("/"))

      if (schema !== null) {
        delete json[k]
        Object.assign(json, schema)
      }
    }
    else if (typeof json[k] === 'object' && json[k] !== null) resolve_refs(json[k], original_json, schema_id)
  }
}

function getLocalRef(ref, json) {
  console.log("getLocalRef")
  for (let i = 1; i < ref.length; i++) {
    if (ref[i] in json) json = json[ref[i]]
    else if ("type" in json) {
      if ("object" in json.type && ref[i] in json.type.object) json = json.type.object[ref[i]]
      else if ("array" in json.type && ref[i] in json.type.array) json = json.type.array[ref[i]]
      else {} // REFERENCIA INVALIDA
    }
    else {} // REFERENCIA INVALIDA
  }

  if (typeof json == "boolean" || typeof json === 'object' && !Array.isArray(json) && json !== null) return json
  else {} // REFERENCIA INVALIDA
}

/* function getForeignRef(ref) {
  let schemaIndex = refs.indexOf(refs.id == "/" + ref[0])
  
  if (schemaIndex )
} */

module.exports = router;
