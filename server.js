// ==============================================================================
// BACKEND: API REST de Joyería (Manillas de Oro 18k) con Soporte PostgreSQL
// ==============================================================================
// Servidor Express conectado a base de datos PostgreSQL persistente (Render/Neon/Supabase)
// con Auto-Seed inicial desde db.json y fallback local.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// ------------------------------------------------------------------------------
// 1. CONFIGURACIÓN DE POSTGRESQL
// ------------------------------------------------------------------------------
const isPg = Boolean(process.env.DATABASE_URL);
let pool = null;

if (isPg) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
  });
  console.log('✓ Conexión configurada con PostgreSQL persistente');
} else {
  console.log('ℹ DATABASE_URL no detectada: Operando en modo local con db.json');
}

// ------------------------------------------------------------------------------
// 2. INICIALIZACIÓN DE TABLAS Y AUTO-SEED
// ------------------------------------------------------------------------------
async function initDB() {
  if (isPg) {
    try {
      // Crear tabla productos si no existe
      await pool.query(`
        CREATE TABLE IF NOT EXISTS productos (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          material VARCHAR(100),
          peso VARCHAR(50),
          precio NUMERIC NOT NULL,
          stock INTEGER DEFAULT 0,
          imagen TEXT,
          descripcion TEXT
        );
      `);
      console.log('✓ Tabla "productos" verificada/creada en PostgreSQL');

      // Auto-Seed: Solo se ejecuta si la tabla está completamente vacía
      const { rows } = await pool.query('SELECT COUNT(*) FROM productos');
      const count = parseInt(rows[0].count, 10);

      if (count === 0) {
        console.log('ℹ Base de datos vacía. Ejecutando Auto-Seed desde db.json...');
        const seedPath = path.join(__dirname, 'db.json');
        if (fs.existsSync(seedPath)) {
          const rawData = fs.readFileSync(seedPath, 'utf8');
          const seedData = JSON.parse(rawData);
          const items = seedData.productos || [];

          for (const item of items) {
            await pool.query(
              `
              INSERT INTO productos (nombre, material, peso, precio, stock, imagen, descripcion)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
              [
                item.nombre || '',
                item.material || '',
                item.peso || '',
                Number(item.precio) || 0,
                Number(item.stock) || 0,
                item.imagen || '',
                item.descripcion || '',
              ]
            );
          }
          console.log(`✓ Auto-Seed completado: ${items.length} productos iniciales insertados.`);
        }
      }
    } catch (err) {
      console.error('Error al inicializar PostgreSQL:', err);
    }
  }
}

// Formateador estándar de productos
function formatProduct(row) {
  return {
    id: Number(row.id),
    nombre: row.nombre,
    material: row.material,
    peso: row.peso,
    precio: Number(row.precio),
    stock: Number(row.stock),
    imagen: row.imagen,
    descripcion: row.descripcion || '',
  };
}

// ------------------------------------------------------------------------------
// 3. ENDPOINTS REST (100% COMPATIBLES CON EL FRONTEND)
// ------------------------------------------------------------------------------

// GET /productos - Listar todos los productos
app.get('/productos', async (req, res) => {
  try {
    if (isPg) {
      const { rows } = await pool.query('SELECT * FROM productos ORDER BY id ASC');
      return res.json(rows.map(formatProduct));
    } else {
      const raw = fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8');
      const data = JSON.parse(raw);
      return res.json(data.productos || []);
    }
  } catch (err) {
    console.error('Error en GET /productos:', err);
    res.status(500).json({ error: 'Error al consultar productos' });
  }
});

// GET /productos/:id - Obtener un producto por ID
app.get('/productos/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    if (isPg) {
      const { rows } = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      return res.json(formatProduct(rows[0]));
    } else {
      const raw = fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8');
      const data = JSON.parse(raw);
      const item = (data.productos || []).find((p) => Number(p.id) === id);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });
      return res.json(item);
    }
  } catch (err) {
    console.error('Error en GET /productos/:id:', err);
    res.status(500).json({ error: 'Error al consultar el producto' });
  }
});

// POST /productos - Crear un nuevo producto
app.post('/productos', async (req, res) => {
  const { nombre, material, peso, precio, stock, imagen, descripcion } = req.body;
  try {
    if (isPg) {
      const { rows } = await pool.query(
        `
        INSERT INTO productos (nombre, material, peso, precio, stock, imagen, descripcion)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
        [
          nombre || '',
          material || '',
          peso || '',
          Number(precio) || 0,
          Number(stock) || 0,
          imagen || '',
          descripcion || '',
        ]
      );
      return res.status(201).json(formatProduct(rows[0]));
    } else {
      const seedPath = path.join(__dirname, 'db.json');
      const raw = fs.readFileSync(seedPath, 'utf8');
      const data = JSON.parse(raw);
      const newId =
        data.productos.length > 0
          ? Math.max(...data.productos.map((p) => Number(p.id) || 0)) + 1
          : 1;
      const newItem = {
        id: newId,
        nombre: nombre || '',
        material: material || '',
        peso: peso || '',
        precio: Number(precio) || 0,
        stock: Number(stock) || 0,
        imagen: imagen || '',
        descripcion: descripcion || '',
      };
      data.productos.push(newItem);
      fs.writeFileSync(seedPath, JSON.stringify(data, null, 2), 'utf8');
      return res.status(201).json(newItem);
    }
  } catch (err) {
    console.error('Error en POST /productos:', err);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
});

// PUT /productos/:id - Actualizar un producto existente
app.put('/productos/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { nombre, material, peso, precio, stock, imagen, descripcion } = req.body;
  try {
    if (isPg) {
      const { rows } = await pool.query(
        `
        UPDATE productos
        SET nombre = $1, material = $2, peso = $3, precio = $4, stock = $5, imagen = $6, descripcion = $7
        WHERE id = $8
        RETURNING *
      `,
        [
          nombre || '',
          material || '',
          peso || '',
          Number(precio) || 0,
          Number(stock) || 0,
          imagen || '',
          descripcion || '',
          id,
        ]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      return res.json(formatProduct(rows[0]));
    } else {
      const seedPath = path.join(__dirname, 'db.json');
      const raw = fs.readFileSync(seedPath, 'utf8');
      const data = JSON.parse(raw);
      const idx = data.productos.findIndex((p) => Number(p.id) === id);
      if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });

      const updated = {
        id,
        nombre: nombre !== undefined ? nombre : data.productos[idx].nombre,
        material: material !== undefined ? material : data.productos[idx].material,
        peso: peso !== undefined ? peso : data.productos[idx].peso,
        precio: precio !== undefined ? Number(precio) : data.productos[idx].precio,
        stock: stock !== undefined ? Number(stock) : data.productos[idx].stock,
        imagen: imagen !== undefined ? imagen : data.productos[idx].imagen,
        descripcion: descripcion !== undefined ? descripcion : data.productos[idx].descripcion,
      };

      data.productos[idx] = updated;
      fs.writeFileSync(seedPath, JSON.stringify(data, null, 2), 'utf8');
      return res.json(updated);
    }
  } catch (err) {
    console.error('Error en PUT /productos/:id:', err);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

// DELETE /productos/:id - Eliminar un producto
app.delete('/productos/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    if (isPg) {
      const { rows } = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING id', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      return res.json({ success: true, id });
    } else {
      const seedPath = path.join(__dirname, 'db.json');
      const raw = fs.readFileSync(seedPath, 'utf8');
      const data = JSON.parse(raw);
      data.productos = data.productos.filter((p) => Number(p.id) !== id);
      fs.writeFileSync(seedPath, JSON.stringify(data, null, 2), 'utf8');
      return res.json({ success: true, id });
    }
  } catch (err) {
    console.error('Error en DELETE /productos/:id:', err);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

// ------------------------------------------------------------------------------
// 4. INICIO DEL SERVIDOR
// ------------------------------------------------------------------------------
initDB().then(() => {
  app.listen(PORT, () => {
    console.log('=========================================');
    console.log(` Joyería API REST corriendo en el puerto ${PORT}`);
    console.log(` Modo Persistencia: ${isPg ? 'PostgreSQL en la Nube' : 'db.json local'}`);
    console.log(` Endpoint: http://localhost:${PORT}/productos`);
    console.log('=========================================');
  });
});
