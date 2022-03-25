var express = require('express');
var router = express.Router();

const dslParser = require('../grammars/datagen_dsl/parser')
const jsonParser = require('../grammars/json_schema/parser')

const dslConverter = require('../grammars/datagen_dsl/conversions')
const jsonConverter = require('../grammars/json_schema/converter')

let refs = []

// POST para gerar um dataset a partir de um XML schema
router.post('/', (req, res) => {
  try {
    let schemas = req.body.json.split("\n\n")

    // extrair dados da schema
    let data = schemas.map(x => jsonParser.parse(x))
    //console.log(JSON.stringify(data))
    console.log('schema parsed')

    for (let i = data.length-1; i >= 0; i--) {
      for (let j = 0; j < data[i].subschemas.length; j++) {
        let subschema = data[i].subschemas[j]
        
        if (subschema.refs.length > 0) {
          let resolved = resolve_localRefs(subschema.schema, subschema.id, subschema.refs)
          if (resolved !== true) return res.status(201).jsonp({message: resolved})
        }
        
        // guardar schemas que podem ser referenciadas e/ou ainda têm referências por resolver
        if (!(/^anon\d+/.test(subschema.id) && !subschema.refs.length)) refs.push(subschema)
      }
    }
    
    let crossRefs = resolve_foreignRefs()
    if (crossRefs !== true) return res.status(201).jsonp({message: crossRefs})

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


function resolve_localRefs(json, schema_id, schema_refs) {
  for (let i = 0; i < schema_refs.length; i++) {
    let ref = schema_refs[i].$ref
    let schema = null, nested_ref = false
    if (ref.startsWith(schema_id)) ref = ref.replace(schema_id, "#")

    if (ref == "#" || ref == schema_id) {}
    else if (/^#\//.test(ref)) {
      schema = replace_ref(ref.split("/"), json)
      if (schema === false) return `A $ref '${schema_refs[i].$ref}' é inválida!`
      if (schema !== true && "$ref" in schema) nested_ref = true
    }
    else if (/^#/.test(ref)) return `A $ref '${schema_refs[i].$ref}' é inválida!`

    if (schema !== null) {
      delete schema_refs[i].$ref
      Object.assign(schema_refs[i--], schema)
      if (!nested_ref) schema_refs.splice(i+1, 1)
    }
  }
  
  return true
}

function resolve_foreignRefs() {
  let refs_map = refs.reduce((acc, cur) => {acc[cur.id] = cur.refs.map(x => x.$ref); return acc}, {})
  
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
    Object.keys(refs_map).filter(k => !queue.includes(k)).map(id => {
      let parsedIndexes = []

      for (let i = 0; i < refs_map[id].length; i++) {
        let ref = refs_map[id][i], schema, nested_ref = false

        if (queue.includes(ref)) {
          let ref_id = queue[queue.findIndex(x => ref.startsWith(x))]

          schema = replace_ref(ref.replace(ref_id, "#").split("/"), refs[refs.findIndex(x => x.id == ref)].schema)
          if (schema === false) return `A $ref '${refs_map[id][i]}' é inválida!`
          if (schema !== true && "$ref" in schema) nested_ref = true

          let refs_elem = refs[refs.findIndex(x => x.id == id)]
          delete refs_elem.refs[i].$ref
          Object.assign(refs_elem.refs[i], schema)

          if (nested_ref) i--
          else parsedIndexes.push(i) 
        }
      }

      parsedIndexes.map(i => refs_map[id].splice(i, 1))
      if (!refs_map[id].length) queue.push(id)
    })
  }

  return true
}

function replace_ref(ref, json) {
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

module.exports = router;
