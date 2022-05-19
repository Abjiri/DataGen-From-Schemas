function searchSchemaId(schema, old_label/* , labels */) {
    let depth = 0, chunks = []

    for (let i = 0; i < schema.length; i++) {
        if (schema[i] == "{") {
            if (!depth) chunks.push({init: i})
            if (depth == 1) chunks[chunks.length-1].end = i
            depth++
        }
        if (schema[i] == "}") {
            if (depth == 2) chunks.push({init: i+1})
            if (depth == 1) chunks[chunks.length-1].end = i+1
            depth--
        }
    }

    let id_regex = /"\$id":\s*"(https:\/\/datagen.di.uminho.pt)?\/json-schemas\/[^",}]+"/
    for (let i = 0; i < chunks.length; i++) {
        let str = schema.substring(chunks[i].init, chunks[i].end)

        if (id_regex.test(str)) {
            return str.match(id_regex)[0].split('/json-schemas/')[1].slice(0,-1)
            /* let new_label = str.match(id_regex)[0].split('/json-schemas/')[1].slice(0,-1)
            
            if (!labels.includes(new_label)) return new_label
            else {
                let nr = 2
                while (labels.includes(new_label + nr)) nr++
                return new_label + nr
            } */
        }
    }

    return "S" + old_label.slice(1).replace("_"," ")
}

function getAllIds(schemas) {
    return schemas.reduce((acc, cur) => {
        let id_matches = cur.matchAll(/"\$id":\s*"(https:\/\/datagen.di.uminho.pt)?\/json-schemas\/[^",}]+"/g)
        acc = acc.concat([...id_matches].map(x => x[0].split('/json-schemas/')[1].slice(0,-1)))
        return acc
    }, [])
}

function removeRepeatedSchemas(tabs, main_schema_key) {
    let inputs = tabs.map(t => {return {key: t.key, input: t.input}})
    let repeated_inputs = {indexes: [], groups: []}

    for (let i = 0; i < inputs.length; i++) {
        if (!repeated_inputs.indexes.includes(i)) {
        // guardar índices do array original de todos os inputs repetidos
        let i_repeat = inputs.slice(i+1, inputs.length).filter((x,j) => {if (x.input == inputs[i].input) return {index: i+j+1, key: x.key}})

        if (i_repeat.length > 0) {
            let group = [{index: i, key: inputs[i].key}, ...i_repeat]
            repeated_inputs.indexes = repeated_inputs.indexes.concat(group.map(x => x.index))
            repeated_inputs.groups.push(group.map(x => x.key))
        }
        }
    }

    for (let i = 0; i < repeated_inputs.groups.length; i++) {
        // se nenhum dos repetidos for a main schema, deixar uma cópia
        if (!repeated_inputs.groups[i].includes(main_schema_key)) repeated_inputs.groups[i].pop()

        // senão, deixar a main schema
        repeated_inputs.groups[i].map(x => {
            if (x != main_schema_key) tabs.splice(tabs.findIndex(t => t.key == x), 1)
        })
    }

    return tabs
}

module.exports = {
    searchSchemaId,
    getAllIds,
    removeRepeatedSchemas
}