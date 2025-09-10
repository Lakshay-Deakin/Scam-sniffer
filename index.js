const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => res.send('Welcome to new project'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
