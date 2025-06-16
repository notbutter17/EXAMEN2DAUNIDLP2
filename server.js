const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const bcrypt = require('bcryptjs');


const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Configuración de PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'coleccion_postulantes', // Reemplaza con tu nombre real si es distinto
  password: '123456',         // Reemplaza con tu contraseña
  port: 5432,
});

// Ruta para subir documento y registrar postulante
app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
  const { nombre, dni, tipo_documento } = req.body;
  const archivo = req.file;

  try {
    // 1. Verificar si el postulante ya existe
    let result = await pool.query('SELECT id FROM postulantes WHERE dni = $1', [dni]);
    let postulanteId;

    if (result.rows.length === 0) {
      // 2. Insertar postulante nuevo
      const nuevo = await pool.query(
        'INSERT INTO postulantes (nombre, dni) VALUES ($1, $2) RETURNING id',
        [nombre, dni]
      );
      postulanteId = nuevo.rows[0].id;
    } else {
      postulanteId = result.rows[0].id;
    }

    // 3. Insertar el documento relacionado al postulante
    await pool.query(
      'INSERT INTO documentos (postulante_id, tipo_documento, archivo_url) VALUES ($1, $2, $3)',
      [postulanteId, tipo_documento, archivo.path]
    );

    res.status(200).json({ message: 'Documento subido correctamente.' });
  } catch (error) {
    console.error('Error al procesar la solicitud:', error);
    res.status(500).json({ error: 'Error al guardar el documento.' });
  }
});

// Ruta para obtener todos los documentos
app.get('/api/documents', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, p.nombre, p.dni, d.tipo_documento, d.archivo_url, d.estado, d.fecha_subida 
       FROM documentos d
       JOIN postulantes p ON d.postulante_id = p.id`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los documentos' });
  }
});

// Ruta para actualizar el estado de un documento
app.put('/api/documents/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    const result = await pool.query(
      'UPDATE documentos SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el estado' });
  }
});


// Ruta para crear un nuevo usuario
app.post('/api/users', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // Verificar si el usuario ya existe
    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);

    if (result.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash de la contraseña usando bcryptjs
    const salt = bcrypt.genSaltSync(10);  // Genera un "salt" con 10 rondas de hash
    const hashedPassword = bcrypt.hashSync(password, salt);  // Hashea la contraseña

    // Insertar el nuevo usuario en la base de datos con la contraseña hasheada
    const newUser = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );

    res.status(201).json({ message: 'User created successfully', userId: newUser.rows[0].id });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Ruta para el login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // Buscar el usuario por su nombre de usuario
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Usuario no encontrado' });
    }

    // El usuario fue encontrado, ahora comparamos las contraseñas
    const user = result.rows[0]; // El primer (y único) usuario encontrado

    // Comparar la contraseña ingresada con la contraseña hasheada en la base de datos
    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
      return res.status(400).json({ message: 'Contraseña incorrecta' });
    }

    // Si las contraseñas coinciden, responder con un mensaje de éxito
    res.status(200).json({ message: 'Login exitoso', userId: user.id });

  } catch (error) {
    console.error('Error al realizar el login:', error);
    res.status(500).json({ message: 'Error en el login' });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor backend corriendo en http://localhost:${port}`);
});
