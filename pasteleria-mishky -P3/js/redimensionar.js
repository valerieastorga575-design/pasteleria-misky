   const sharp = require("sharp");
   const fs = require("fs");
   const path = require("path");

   const carpeta = "img/productos";
   const anchos = [400, 800];

   (async () => {
     for (const archivo of fs.readdirSync(carpeta)) {
       const { name, ext } = path.parse(archivo);
       // Solo originales .jpg (se saltan los ya reducidos, como "torta-400")
       if (ext.toLowerCase() !== ".jpg" || /-\d+$/.test(name)) continue;
       for (const ancho of anchos) {
         await sharp(path.join(carpeta, archivo))
           .resize({ width: ancho })
           .jpeg({ quality: 80 })
           .toFile(path.join(carpeta, `${name}-${ancho}.jpg`));
       }
       console.log("Listo:", name);
     }
   })();