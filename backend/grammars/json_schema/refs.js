let copy = x => JSON.parse(JSON.stringify(x))

function resolve_refs(data, settings) {
	let refs = []

	for (let i = data.length-1; i >= 0; i--) {
		for (let j = 0; j < data[i].subschemas.length; j++) {
			let subschema = data[i].subschemas[j]
			
			if (subschema.refs.length > 0) {
				let resolved = resolve_localRefs(subschema.schema, subschema.id, subschema.refs, settings.RECURSIV)
				if (resolved !== true) return resolved
			}
			
			// guardar schemas que podem ser referenciadas e/ou ainda têm referências por resolver
			if (!(/^anon\d+/.test(subschema.id) && !subschema.refs.length)) refs.push(subschema)
		}
	}

	let crossRefs = resolve_foreignRefs(refs)
	if (crossRefs !== true) return crossRefs
	return true
}
  
function resolve_localRefs(json, schema_id, schema_refs, recursiv) {
	for (let i = 0; i < schema_refs.length; i++) {
		let ref = schema_refs[i].$ref
		let schema = null, nested_ref = false
		if (ref.startsWith(schema_id)) ref = ref.replace(schema_id, "#")

		if (ref == "#") {
			resolve_recursiveRefs(json, schema_id, schema_refs[i], recursiv)
			schema_refs.splice(i--, 1)
		}
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
  
function resolve_foreignRefs(refs) {
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
	    ids.filter(k => !queue.includes(k)).map(id => {
        let parsedIndexes = []
  
        for (let i = 0; i < refs_map[id].length; i++) {
          let ref = refs_map[id][i], schema, nested_ref = false
          let ref_id_index = queue.findIndex(x => ref.startsWith(x))

          if (ref_id_index == -1) return `A $ref '${refs_map[id][i]}' é inválida!`
          else {
            let ref_id = queue[ref_id_index]
            ref = ref.replace(ref_id, "#")

            schema = replace_ref(ref.split("/"), refs[refs.findIndex(x => x.id == ref_id)].schema)
            if (schema === false) return `A $ref '${refs_map[id][i]}' é inválida!`
            if (schema !== true && "$ref" in schema) nested_ref = true
  
            let refs_elem = refs[refs.findIndex(x => x.id == id)]
            delete refs_elem.refs[i].$ref
            Object.assign(refs_elem.refs[i], schema)
  
            if (nested_ref) i--
            else parsedIndexes.push(i) 
          }
        }
  
        parsedIndexes.reverse().map(i => refs_map[id].splice(i, 1))
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

function resolve_recursiveRefs(json, schema_id, schema_ref, recursiv) {
	Object.keys(recursiv).map(k => recursiv[k] = parseInt(recursiv[k]))

	let occurs = Math.floor(Math.random() * ((recursiv.UPPER+1) - recursiv.LOWER) + recursiv.LOWER)
	let ref_path = get_refPath(json, schema_id, [], 0)

	delete schema_ref.$ref
	let json_copy = copy(json)

	let recursiv_type
	if (typeof ref_path[ref_path.length-1] == "number") recursiv_type = "schema_array"
	else {
		for (let i = ref_path.length-1; i >= 0; i--) {
			if (ref_path[i] == "type") {
				recursiv_type = ref_path[i+1]
				if (recursiv_type == "object") recursiv_type += "_" + ref_path[i+2]
				break
			}
		}
	}

	let recFlag_depth = ref_path.length - ((recursiv_type == "array" || (/^object_[^p]/.test(recursiv_type))) ? 1 : 2)
	for (let i = 0; i < occurs; i++) {
		// garantir que tem o limite inferior de recursividade manualmente, impedindo que gere arrays/objetos vazios que não tenham recursividade
		ref_path.map((x,j) => {
			if (i < recursiv.LOWER && j == recFlag_depth) {
				// nr de elementos/props que é necessário gerar para garantir que inclui a referência recursiva
				let offset
				if (recursiv_type == "schema_array") offset = ref_path[j+1] + 1
				if (recursiv_type == "array") offset = "prefixItems" in json ? (json.prefixItems.length + 1) : 1
				if (recursiv_type.startsWith("object")) offset = {key: ref_path[ref_path.length-2], prop: ref_path[ref_path.length-1]}

				json.recursive = offset
			}
			json = json[x]
		})
		Object.assign(json, copy(json_copy))
	}

	let path_end = ref_path.pop()

	if (recursiv_type == "schema_array") {
		ref_path.map(x => json = json[x])
		json.splice(path_end, 1)
	}
	else {
		// recursividade de tipos 'array'
		if (recursiv_type == "array") {
			path_end = ref_path.splice(ref_path.length-3, ref_path.length)
			ref_path.map(x => json = json[x])
			delete json[path_end[0]]
		}
		// recursividade de tipos 'object'
		if (recursiv_type.startsWith("object")) {
			ref_path.map(x => json = json[x])
			delete json[path_end]
		}
	}

	return true
}

function get_refPath(json, schema_id, path, depth) {
  let keys = Array.isArray(json) ? [...Array(json.length).keys()] : Object.keys(json)
	
  for (let i = 0; i < keys.length; i++) {
    let k = keys[i]

    if (k == "$ref" && (json[k] == "#" || json[k] == schema_id)) return !depth ? path : true
		else if (typeof json[k] === 'object' && json[k] !== null) {
			path.push(k)

			if (get_refPath(json[k], schema_id, path, depth+1) === false) path.pop()
			else return !depth ? path : true
		}
	}

	return false
}

module.exports = { resolve_refs }