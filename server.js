// ==============================================================================
// BACKEND: Servidor JSON Server para Joyería (Manillas de Oro)
// ==============================================================================
// Este archivo configura un servidor REST rápido y sencillo utilizando JSON Server.
// Proporciona automáticamente endpoints CRUD (GET, POST, PUT, PATCH, DELETE)
// para los datos definidos en el archivo 'db.json'.

const jsonServer = require('json-server');
const cors = require('cors');
const path = require('path');

// 1. Creamos la instancia de la aplicación json-server
const server = jsonServer.create();

// 2. Cargamos el archivo de datos (db.json) como enrutador
const router = jsonServer.router(path.join(__dirname, 'db.json'));

// 3. Cargamos los middlewares predeterminados (logger, static, etc.)
const middlewares = jsonServer.defaults();

// 4. Habilitamos CORS para permitir peticiones desde cualquier origen (Frontend)
server.use(cors());

// 5. Usamos los middlewares por defecto
server.use(middlewares);

// 6. Permitimos que el servidor entienda peticiones con cuerpo JSON
server.use(jsonServer.bodyParser);

// 7. Conectamos las rutas automáticas generadas a partir de db.json
// Esto creará automáticamente rutas como:
// GET    /productos      -> Lista todos los productos
// GET    /productos/:id  -> Obtiene un producto por ID
// POST   /productos      -> Crea un nuevo producto
// PUT    /productos/:id  -> Actualiza un producto completo
// PATCH  /productos/:id  -> Actualiza parcialmente un producto
// DELETE /productos/:id  -> Elimina un producto por ID
server.use(router);

// 8. Definimos el puerto: Render asigna automáticamente la variable process.env.PORT.
// Si estamos en entorno local, utilizará el puerto 5000 por defecto.
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Joyería API corriendo exitosamente!`);
  console.log(` Puerto: ${PORT}`);
  console.log(` Endpoint: http://localhost:${PORT}/productos`);
  console.log(`=========================================`);
});
