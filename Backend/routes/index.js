var express = require('express');
var router = express.Router();
var axios = require('axios');

const parser = require('../grammar/parser')
const converter = require('../converter/converter')

// POST para gerar um dataset a partir de um XML schema
router.post('/xml_schema', (req, res) => {
  try {
    let data = parser.parse(req.body.xsd)

    for (let i = 0; i < data.unbounded_min; i++) {
      if (data.unbounded_min[i] > req.body.unbounded) {
        let message = `Um elemento na schema tem minOccurs='${data.unbounded_min[i]}' e maxOccurs='unbounded', o que é inválido porque o máximo de repetições geráveis está definido como '${req.body.unbounded}'.`
        return res.status(201).jsonp({message})
      }
    }

    let model = converter.convertXSD(data.xsd, data.simpleTypes, req.body.unbounded)

    //https://datagen.di.uminho.pt/api/datagen/xml
    axios.post("http://localhost:12080/api/datagen/xml", model, {headers: {'Content-Type': 'text/plain'}})
      .then(data => res.status(201).jsonp(data.data))
      .catch(err => res.status(201).jsonp(err))

  } catch (err) {res.status(201).jsonp(err)}
});

module.exports = router;
