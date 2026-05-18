import { stitchService } from './stitch_mcp.js';

async function probarStitch() {
  try {
    console.log("Iniciando prueba de conexión...");
    const tools = await stitchService.getTools();
    console.log("\n=== Herramientas disponibles en Stitch ===");
    if (tools.tools && tools.tools.length > 0) {
      tools.tools.forEach(tool => {
        console.log(`- Nombre: ${tool.name}`);
        console.log(`  Descripción: ${tool.description}`);
      });
    } else {
      console.log("No hay herramientas configuradas en este MCP.");
    }
    console.log("=========================================\n");
  } catch (error) {
    console.error("\nFallo al comunicarse con Stitch:", error.message || error);
  }
}

probarStitch();
