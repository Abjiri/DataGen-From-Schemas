var express = require('express');
var router = express.Router();

const dslParser = require('../grammars/datagen_dsl/parser')
const jsonParser = require('../grammars/json_schema/parser')

const dslConverter = require('../grammars/datagen_dsl/conversions')
const jsonConverter = require('../grammars/json_schema/converter')

let copy = x => JSON.parse(JSON.stringify(x))
let refs = []

// POST para gerar um dataset a partir de um XML schema
router.post('/', (req, res) => {
  try {
    let schemas = req.body.json.split("\n\n")

    // extrair dados da schema
    let data = schemas.map(x => jsonParser.parse(x))
    console.log(JSON.stringify(data))
    console.log('schema parsed')

    for (let i = data.length-1; i >= 0; i--) {
      for (let j = 0; j < data[i].subschemas.length; j++) {
        let subschema = data[i].subschemas[j]
        
        if (subschema.refs.length > 0) {
          let resolved = resolve_refs(subschema.schema, subschema.schema, subschema.id, subschema.refs)
          if (resolved !== true) return res.status(201).jsonp({message: resolved})
        }
        
        // guardar schemas que podem ser referenciadas e/ou ainda têm referências por resolver
        if (!(/^anon\d+/.test(subschema.id) && !subschema.refs.length)) refs.push(subschema)
      }
    }
    
    /* let crossRefs = check_crossRefs()
    if (typeof crossRefs == "string") return res.status(201).jsonp({message: crossRefs})

    for (let i = 0; i < crossRefs.length; i++) {
      let subschema = refs[crossRefs[i]]
      
      if (subschema.refs.length > 0) {
        let resolved = resolve_refs(subschema.schema, subschema.schema, subschema.id, subschema.refs)
        if (resolved !== true) return res.status(201).jsonp({message: resolved})
      }
    }

    console.log("--------------------")
    console.log(JSON.stringify(refs)) */

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

function resolve_refs(json, original_json, schema_id, schema_refs) {
  for (let i = 0; i < schema_refs.length; i++) {
    let ref = schema_refs[i].$ref
    let schema = null, nested_ref = false
    if (ref.startsWith(schema_id)) ref = ref.replace(schema_id, "#")
    console.log("ref:",ref)

    if (ref == "#" || ref == schema_id) {}
    else if (/^#\//.test(ref)) {
      schema = getLocalRef(ref.split("/"), copy(original_json))
      if (schema === false) return `A $ref '${json[k]}' é inválida!`
      if (schema !== true && "$ref" in schema) nested_ref = true
    }
    else if (/^#/.test(ref)) return `A $ref '${json[k]}' é inválida!`
    else schema = getForeignRef(ref.split("/"))

    if (schema !== null) {
      delete schema_refs[i].$ref
      Object.assign(schema_refs[i--], schema)
      if (!nested_ref) schema_refs.splice(i+1, 1)
    }
  }
  
  return true
}

function getLocalRef(ref, json) {
  for (let i = 1; i < ref.length; i++) {
    if (ref[i] in json) json = json[ref[i]]
    else if ("type" in json) {
      if ("object" in json.type && ref[i] in json.type.object) json = json.type.object[ref[i]]
      else if ("array" in json.type && ref[i] in json.type.array) json = json.type.array[ref[i]]
      else return false
    }
    else return false
  }

  if (typeof json == "boolean" || typeof json === 'object' && !Array.isArray(json) && json !== null) return json
  return false
}

function check_crossRefs() {
  let refs_map = refs.reduce((acc, cur) => {acc[cur.id] = cur.refs; return acc}, {})
  console.log("refs_map:",refs_map)
  
  for (let k in refs_map) {
    for (let i = 0; i < refs_map[k].length; i++) {
      let ref = refs_map[k][i]

      // loop infinito de recursividade
      if (ref in refs_map && refs_map[ref].includes(k)) return `Existe um ciclo infinito de recursividade entre as schemas '${k}' e '${ref}'!`
    }
  }

  let ids = Object.keys(refs_map)
  let queue = ids.filter(k => !refs_map[k].length)

  while (queue.length !== ids.length) {
    for (let i = 0; i < ids.length; i++) {
      if (!queue.includes(ids[i]) && refs_map[ids[i]].every(x => queue.includes(x))) queue.push(ids[i])
    }
  }

  console.log("queue:",queue)
  return queue
}

function getForeignRef(ref) {
  console.log("foreign ref")
  return null
}

module.exports = router;
