const http = require('http');
const app = require('./app');
const server = http.Server(app);
const port = process.env.PORT || 4001;






server.listen(port,()=>{
    console.log(`user service running on port ${port} http://localhost:${port}`);
});