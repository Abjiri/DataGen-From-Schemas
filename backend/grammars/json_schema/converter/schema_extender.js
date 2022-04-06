function extendSchema(json, schema, type) {
    if ("const" in schema) extendPredefinedValue(json, schema, "const")
    else if ("enum" in schema) extendPredefinedValue(json, schema, "enum")
    else {
        if ("default" in schema) extendPredefinedValue(json, schema, "default")

        switch (type) {
            case "number": extendNumeric(json, schema); break
            case "string": extendString(json, schema); break
        }
    }
}

function extendPredefinedValue(json, schema, key) {
    if (key in json) json[key] = json[key].concat(schema[key])
    else json[key] = schema[key]
}

function extendString(json, schema) {
    if ("pattern" in schema) json.pattern = schema.pattern
    else if ("format" in schema) json.format = schema.format
    else {
        let {minLength, maxLength} = schema

        if (minLength != undefined) {
            if ("minLength" in json) {
                if (minLength > json.minLength) json.minLength = minLength
            } 
            else json.minLength = minLength
        }

        if (maxLength != undefined) {
            if ("maxLength" in json) {
                if (maxLength < json.maxLength) json.maxLength = maxLength
            } 
            else json.maxLength = maxLength
        }
    }
}

function extendNumeric(json, schema) {
    let {multipleOf, minimum, maximum, exclusiveMinimum, exclusiveMaximum} = schema
    if ("integer" in schema) json.integer = true

    if (multipleOf !== undefined) {
        if ("multipleOf" in json) json.multipleOf = json.multipleOf.concat(multipleOf.filter(x => !json.multipleOf.includes(x)))
        else json.multipleOf = multipleOf
    }

    if (minimum !== undefined) {
        if ("minimum" in json) {
            if (minimum > json.minimum) json.minimum = minimum
        } 
        else if ("exclusiveMinimum" in json) {
            if (minimum > json.exclusiveMinimum) {json.minimum = minimum; delete json.exclusiveMinimum}
        }
        else json.minimum = minimum
    }
    else if (exclusiveMinimum !== undefined) {
        if ("minimum" in json) {
            if (exclusiveMinimum >= json.minimum) {json.exclusiveMinimum = exclusiveMinimum; delete json.minimum}
        } 
        else if ("exclusiveMinimum" in json) {
            if (exclusiveMinimum > json.exclusiveMinimum) json.exclusiveMinimum = exclusiveMinimum
        }
        else json.exclusiveMinimum = exclusiveMinimum
    }

    if (maximum !== undefined) {
        if ("maximum" in json) {
            if (maximum < json.maximum) json.maximum = maximum
        } 
        else if ("exclusiveMaximum" in json) {
            if (maximum < json.exclusiveMaximum) {json.maximum = maximum; delete json.exclusiveMaximum}
        }
        else json.maximum = maximum
    }
    else if (exclusiveMaximum !== undefined) {
        if ("maximum" in json) {
            if (exclusiveMaximum <= json.maximum) {json.exclusiveMaximum = exclusiveMaximum; delete json.maximum}
        } 
        else if ("exclusiveMaximum" in json) {
            if (exclusiveMaximum < json.exclusiveMaximum) json.exclusiveMaximum = exclusiveMaximum
        }
        else json.exclusiveMaximum = exclusiveMaximum
    }
}

module.exports = { extendSchema }