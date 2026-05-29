const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const transactionRoutes = require("./routes/transactionRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    service: "Hybrid Switch Modernization Platform",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

app.use("/transactions", transactionRoutes);
app.use("/admin", adminRoutes);

app.listen(PORT, () => {
  console.log(`HSMP running on port ${PORT}`);
});