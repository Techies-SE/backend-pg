const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { pool } = require("../db");
const fs = require("fs");
const authenticateToken = require("../middleware/auth");

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads"); // Save to /uploads folder
  },
  filename: (req, file, cb) => {
    const uniqueName = `department-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Get all departments
// router.get("/", authenticateToken, async (req, res) => {
//   try {
//     const { rows } = await pool.query("SELECT * FROM departments");
//     res.json(rows);
//   } catch (err) {
//     console.error("Error fetching departments:", err);
//     res.status(500).json({ error: err.message });
//   }
// });
// router.get("/", authenticateToken, async (req, res) => {
//   try {
//     // Get all departments
//     const departmentsQuery = await pool.query("SELECT * FROM departments");
//     const departments = departmentsQuery.rows;

//     // // Get all doctors grouped by department
//     const doctorsQuery = await pool.query(`
//       SELECT d.*, json_agg(doctors.*) as doctors
//       FROM departments d
//       LEFT JOIN doctors ON doctors.department_id = d.id
//       GROUP BY d.id
//     `);

//     res.json(doctorsQuery.rows);
//   } catch (err) {
//     console.error("Error fetching departments with doctors:", err);
//     res.status(500).json({ error: err.message });
//   }
// });
router.get("/", authenticateToken, async (req, res) => {
  try {
    // Get all departments
    const departmentsQuery = await pool.query(
      "SELECT * FROM departments ORDER BY id"
    );
    const departments = departmentsQuery.rows;

    // Get all doctors with their schedules
    const doctorsQuery = await pool.query(`
      SELECT 
        d.*,
        COALESCE(
          json_agg(
            json_build_object(
              'schedule_id', ds.id,
              'day_of_week', ds.day_of_week,
              'start_time', ds.start_time,
              'end_time', ds.end_time
            )
          ) FILTER (WHERE ds.id IS NOT NULL),
          '[]'::json
        ) AS schedules
      FROM 
        doctors d
      LEFT JOIN 
        doctor_schedules ds ON ds.doctor_id = d.id
      GROUP BY 
        d.id
    `);
    const doctors = doctorsQuery.rows;

    // Combine the data
    const result = departments.map((department) => {
      const departmentDoctors = doctors
        .filter((doctor) => doctor.department_id === department.id)
        .map((doctor) => ({
          id: doctor.id,
          name: doctor.name,
          phone_no: doctor.phone_no,
          email: doctor.email,
          specialization: doctor.specialization,
          status: doctor.status,
          image: doctor.image,
          schedules: doctor.schedules,
        }));

      return {
        id: department.id,
        name: department.name,
        image: department.image,
        description: department.description,
        doctors: departmentDoctors,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(
      "Error fetching departments with doctors and schedules:",
      err
    );
    res.status(500).json({ error: err.message });
  }
});

// Get a department and its doctors by department ID
router.get("/id=:id", async (req, res) => {
  const departmentId = req.params.id;

  const query = `
    SELECT d.id AS department_id, d.name AS department_name, 
           doc.id AS s, doc.name AS doctor_name, 
           doc.phone_no, doc.email, doc.specialization, doc.status 
    FROM departments d
    LEFT JOIN doctors doc ON d.id = doc.department_id
    WHERE d.id = $1;
  `;

  try {
    const { rows } = await pool.query(query, [departmentId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Department not found" });
    }

    const department = {
      id: rows[0].department_id,
      name: rows[0].department_name,
      doctors: rows
        .filter((row) => row.doctor_id !== null)
        .map((row) => ({
          id: row.doctor_id,
          name: row.doctor_name,
          phone_no: row.phone_no,
          email: row.email,
          specialization: row.specialization,
          status: row.status,
        })),
    };

    res.json(department);
  } catch (err) {
    console.error("Error fetching department details:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH route for department image upload
router.patch(
  "/image/upload/:id",
  upload.single("image"),
  authenticateToken,
  async (req, res) => {
    const departmentId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const imagePath = `uploads/${req.file.filename}`;
    const imageUrl = `http://localhost:3000/${imagePath}`;

    try {
      const { rowCount } = await pool.query(
        "UPDATE departments SET image = $1 WHERE id = $2",
        [imagePath, departmentId]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      res.json({
        message: "Department image updated",
        imagePath,
        imageUrl,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete department image
router.delete("/image/delete/:id", authenticateToken, async (req, res) => {
  const departmentId = req.params.id;

  try {
    // Get current image path from DB
    const { rows } = await pool.query(
      "SELECT image FROM departments WHERE id = $1",
      [departmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Department not found" });
    }

    const imagePath = rows[0].image;

    // Delete file from disk if it exists
    if (imagePath) {
      const fullPath = path.join(__dirname, "..", imagePath);
      fs.unlink(fullPath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.warn("Image file deletion failed:", err);
        }
      });
    }

    // Update DB: remove image reference
    await pool.query("UPDATE departments SET image = NULL WHERE id = $1", [
      departmentId,
    ]);

    res.json({ message: "Department image removed successfully" });
  } catch (err) {
    console.error("Error removing department image:", err);
    res.status(500).json({ error: "Failed to remove image" });
  }
});

// Create new department
router.post(
  "/",
  upload.single("image"),
  authenticateToken,
  async (req, res) => {
    const { name, description } = req.body;
    let imagePath = null;

    if (req.file) {
      imagePath = `uploads/${req.file.filename}`;
    }

    try {
      const { rows } = await pool.query(
        "INSERT INTO departments (name, description, image) VALUES ($1, $2, $3) RETURNING *",
        [name, description || null, imagePath]
      );

      res.status(201).json({
        message: "Department created successfully",
        department: {
          id: rows[0].id,
          name: rows[0].name,
          description: rows[0].description || null,
          image: rows[0].image
            ? `http://localhost:3000/${rows[0].image}`
            : null,
        },
      });
    } catch (err) {
      console.error("Error creating department:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Get department counts with doctors
router.get("/doctor-counts", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        d.id AS department_id,
        d.name AS department_name,
        d.description AS description,
        COUNT(doc.id) AS doctor_count
      FROM 
        departments d
      LEFT JOIN 
        doctors doc ON d.id = doc.department_id
      GROUP BY 
        d.id, d.name, d.description
      ORDER BY 
        d.id;
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching doctor counts:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get department details by ID
router.get("/:id", authenticateToken, async (req, res) => {
  const departmentId = req.params.id;

  const query = `
    SELECT d.id AS department_id, d.name AS department_name, d.description AS department_description, d.image AS department_image,
           doc.name AS doctor_name, 
           doc.phone_no, doc.email, doc.specialization
    FROM departments d
    LEFT JOIN doctors doc ON d.id = doc.department_id
    WHERE d.id = $1;
  `;

  try {
    const { rows } = await pool.query(query, [departmentId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Department not found" });
    }

    const department = {
      id: rows[0].department_id,
      name: rows[0].department_name,
      description: rows[0].department_description,
      image: rows[0].department_image,
      imageUrl: rows[0].department_image
        ? `http://localhost:3000/${rows[0].department_image}`
        : null,
      doctors: rows
        .filter((row) => row.doctor_name !== null)
        .map((row) => ({
          name: row.doctor_name,
          phone_no: row.phone_no,
          email: row.email,
          specialization: row.specialization,
        })),
    };

    res.json(department);
  } catch (err) {
    console.error("Error fetching department details:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE department by ID (including image cleanup)
router.delete("/:id", authenticateToken, async (req, res) => {
  const departmentId = req.params.id;

  try {
    // Step 1: Get current image path
    const { rows } = await pool.query(
      "SELECT image FROM departments WHERE id = $1",
      [departmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Department not found" });
    }

    const imagePath = rows[0].image;

    // Step 2: Delete image from disk (if exists)
    if (imagePath) {
      const fullPath = path.join(__dirname, "..", imagePath);
      fs.unlink(fullPath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.warn("Image file deletion failed:", err);
        }
      });
    }

    // Step 3: Delete department from DB
    await pool.query("DELETE FROM departments WHERE id = $1", [departmentId]);

    res.json({ message: "Department deleted successfully" });
  } catch (err) {
    console.error("Error deleting department:", err);
    res.status(500).json({ error: "Failed to delete department" });
  }
});

module.exports = router;
