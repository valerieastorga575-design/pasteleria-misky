
// =============================================================
// Pastelería Mishky · Catálogo dinámico
// =============================================================
const RUTA_DATOS = "data/productos.json";
const RUTA_RESPALDO = "img/sin-imagen.jpg";
const TODAS = "Todas";
const EXT_IMAGEN = /\.(jpe?g|png|webp|avif)$/i;
const ANCHOS_IMG = [160, 320];
const NUM_FANTASMAS = 8;

// Referencias al DOM
const contFiltros = document.querySelector("#filtros");
const contControles = document.querySelector("#controles");
const buscador = document.querySelector("#busqueda");
const selectOrden = document.querySelector("#orden");
const chkDisponibles = document.querySelector("#solo-disponibles");
const grilla = document.querySelector("#grilla");
const estado = document.querySelector("#estado");
const aviso = document.querySelector("#aviso");
const plantilla = document.querySelector("#tpl-producto");

// Elementos del diálogo
const dialogo = document.querySelector("#detalle");
const detImg = document.querySelector("#detalle-img");
const detCategoria = document.querySelector("#detalle-categoria");
const detTitulo = document.querySelector("#detalle-titulo");
const detDescripcion = document.querySelector("#detalle-descripcion");
const detPrecio = document.querySelector("#detalle-precio");
const detPorciones = document.querySelector("#detalle-porciones");
const detStock = document.querySelector("#detalle-stock");
const detCerrar = document.querySelector("#detalle-cerrar");

// Estado de la aplicación
let productos = [];
let categorias = [];
let categoriaActiva = TODAS;
let textoBusqueda = "";
let orden = "defecto";
let soloDisponibles = false;
let disparadorModal = null;

const soles = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN"
});

const comparadores = {
  defecto: (a, b) => a.id - b.id,
  asc: (a, b) => a.precio - b.precio,
  desc: (a, b) => b.precio - a.precio,
  nombre: (a, b) =>
    a.nombre.localeCompare(b.nombre, "es", {
      sensitivity: "base"
    })
};

// -------------------------------------------------------------
// 1. Carga de datos y tratamiento de errores
// -------------------------------------------------------------
function crearError(tipo, mensaje, status = null) {
  const error = new Error(mensaje);
  error.tipo = tipo;
  error.status = status;
  return error;
}

async function cargarProductos() {
  let respuesta;

  try {
    respuesta = await fetch(RUTA_DATOS, {
      cache: "no-store"
    });
  } catch (error) {
    throw crearError(
      "red",
      `No se pudo conectar para leer ${RUTA_DATOS}`
    );
  }

  if (!respuesta.ok) {
    throw crearError(
      "http",
      `No se pudo leer ${RUTA_DATOS} (HTTP ${respuesta.status})`,
      respuesta.status
    );
  }

  let datos;

  try {
    datos = await respuesta.json();
  } catch (error) {
    throw crearError(
      "formato",
      "El archivo JSON tiene errores de sintaxis."
    );
  }

  if (!Array.isArray(datos)) {
    throw crearError(
      "formato",
      "El archivo JSON debe contener un arreglo de productos."
    );
  }

  return datos;
}

// -------------------------------------------------------------
// 2. Validación de cada producto
// -------------------------------------------------------------
function esNumero(valor) {
  return typeof valor === "number" && Number.isFinite(valor);
}

function validarProductos(datos) {
  const ids = new Set();
  const validos = [];
  const descartados = [];

  datos.forEach((producto, indice) => {
    const motivos = [];

    if (
      typeof producto !== "object" ||
      producto === null ||
      Array.isArray(producto)
    ) {
      motivos.push("no es un objeto válido");
    } else {
      if (!esNumero(producto.id)) {
        motivos.push("el id no es numérico");
      } else if (ids.has(producto.id)) {
        motivos.push(`id duplicado (${producto.id})`);
      }

      if (
        typeof producto.nombre !== "string" ||
        !producto.nombre.trim()
      ) {
        motivos.push("nombre vacío");
      }

      if (
        typeof producto.categoria !== "string" ||
        !producto.categoria.trim()
      ) {
        motivos.push("categoría vacía");
      }

      if (
        !esNumero(producto.precio) ||
        producto.precio <= 0
      ) {
        motivos.push("precio no numérico o no positivo");
      }

      if (
        !Number.isInteger(producto.stock) ||
        producto.stock < 0
      ) {
        motivos.push(
          "stock no es un entero mayor o igual a cero"
        );
      }

      if (
        typeof producto.imagen !== "string" ||
        !EXT_IMAGEN.test(producto.imagen)
      ) {
        motivos.push("imagen sin extensión válida");
      }

      if (typeof producto.descripcion !== "string") {
        motivos.push("descripción no válida");
      }

      if (!esNumero(producto.porciones) || producto.porciones < 1) {
        motivos.push("porciones no válidas");
      }
    }

    if (motivos.length > 0) {
      descartados.push({
        posicion: indice + 1,
        id: producto?.id ?? "sin id",
        motivos
      });
    } else {
      ids.add(producto.id);
      validos.push(producto);
    }
  });

  return {
    validos,
    descartados
  };
}

function reportarDescartados(descartados) {
  if (descartados.length === 0) return;

  console.warn(
    `Se descartaron ${descartados.length} producto(s) inválido(s):`
  );

  console.table(
    descartados.map((item) => ({
      posicion: item.posicion,
      id: item.id,
      motivos: item.motivos.join("; ")
    }))
  );

  aviso.textContent =
    `Se omitieron ${descartados.length} producto(s) con datos inválidos. Revise la consola.`;

  aviso.hidden = false;
}

// -------------------------------------------------------------
// 3. Filtros y contadores
// -------------------------------------------------------------
function coincide(producto, categoria) {
  if (
    categoria !== TODAS &&
    producto.categoria !== categoria
  ) {
    return false;
  }

  if (soloDisponibles && producto.stock === 0) {
    return false;
  }

  if (
    textoBusqueda &&
    !producto.nombre.toLowerCase().includes(textoBusqueda)
  ) {
    return false;
  }

  return true;
}

function obtenerCategorias(lista) {
  return [
    TODAS,
    ...new Set(lista.map((producto) => producto.categoria))
  ];
}

// Los botones se crean una sola vez.
// Luego solo se actualiza su texto.
function renderizarFiltros() {
  const fragmento = document.createDocumentFragment();

  categorias.forEach((categoria) => {
    const boton = document.createElement("button");

    boton.type = "button";
    boton.className = "filtro";
    boton.dataset.categoria = categoria;

    boton.setAttribute(
      "aria-pressed",
      String(categoria === categoriaActiva)
    );

    fragmento.append(boton);
  });

  contFiltros.replaceChildren(fragmento);
  actualizarContadores();
}

function actualizarContadores() {
  contFiltros.querySelectorAll(".filtro").forEach((boton) => {
    const categoria = boton.dataset.categoria;

    const cantidad = productos.filter((producto) =>
      coincide(producto, categoria)
    ).length;

    boton.textContent = `${categoria} (${cantidad})`;
  });
}

// -------------------------------------------------------------
// 4. Navegación por hash
// -------------------------------------------------------------
function leerHash() {
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch (error) {
    return "";
  }
}

function categoriaDesdeHash() {
  const categoriaHash = leerHash();

  return categorias.includes(categoriaHash)
    ? categoriaHash
    : TODAS;
}

function actualizarHash(categoria) {
  const nuevaUrl =
    categoria === TODAS
      ? `${location.pathname}${location.search}`
      : `${location.pathname}${location.search}#${encodeURIComponent(categoria)}`;

  history.replaceState(null, "", nuevaUrl);
}

function seleccionarCategoria(categoria, cambiarUrl = true) {
  if (!categorias.includes(categoria)) {
    categoria = TODAS;
  }

  categoriaActiva = categoria;

  contFiltros.querySelectorAll(".filtro").forEach((boton) => {
    boton.setAttribute(
      "aria-pressed",
      String(boton.dataset.categoria === categoriaActiva)
    );
  });

  if (cambiarUrl) {
    actualizarHash(categoriaActiva);
  }

  actualizarContadores();
  renderizarCatalogo();
}

// -------------------------------------------------------------
// 5. Imágenes y tarjetas de productos
// -------------------------------------------------------------
function construirSrcset(ruta) {
  const coincidencia = ruta.match(
    /^(.*)\.(jpe?g|png|webp|avif)$/i
  );

  if (!coincidencia) return "";

  const base = coincidencia[1];
  const extension = coincidencia[2];

  const opciones = ANCHOS_IMG.map(
    (ancho) => `${base}-${ancho}.${extension} ${ancho}w`
  );

  return opciones.join(", ");
}

function crearTarjeta(producto) {
  const nodo = plantilla.content.cloneNode(true);

  const tarjeta = nodo.querySelector(".tarjeta");
  const imagen = nodo.querySelector("img");
  const etiqueta = nodo.querySelector(".etiqueta");

  tarjeta.dataset.id = producto.id;

  imagen.alt = producto.nombre;
  imagen.loading = "lazy";
  imagen.decoding = "async";

  imagen.sizes =
    "(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 280px";

  // El evento load se registra antes de asignar src/srcset.
  imagen.addEventListener(
    "load",
    () => {
      imagen.classList.add("foto-cargada");
    },
    { once: true }
  );

  imagen.addEventListener("error", () => {
    if (imagen.dataset.respaldoUsado === "true") return;

    // Si falla una versión reducida, se prueba la imagen original.
    if (imagen.hasAttribute("srcset")) {
      imagen.removeAttribute("srcset");
      imagen.src = producto.imagen;
      return;
    }

    imagen.dataset.respaldoUsado = "true";
    imagen.src = RUTA_RESPALDO;
  });

  const srcset = construirSrcset(producto.imagen);

  if (srcset) {
    imagen.srcset = srcset;
  }

  imagen.src = producto.imagen;

  nodo.querySelector(".tarjeta__categoria").textContent =
    producto.categoria;

  nodo.querySelector(".tarjeta__abrir").textContent =
    producto.nombre;

  nodo.querySelector(".tarjeta__descripcion").textContent =
    producto.descripcion;

  nodo.querySelector(".tarjeta__precio").textContent =
    soles.format(producto.precio);

  nodo.querySelector(".tarjeta__porciones").textContent =
    producto.porciones > 1
      ? `${producto.porciones} porciones`
      : "1 unidad";

  if (producto.stock === 0) {
    etiqueta.textContent = "Agotado";
    etiqueta.classList.add("etiqueta--agotado");
    etiqueta.hidden = false;

    tarjeta.classList.add("tarjeta--agotado");
  } else if (producto.destacado) {
    etiqueta.textContent = "Favorito";
    etiqueta.hidden = false;
  }

  return nodo;
}

// -------------------------------------------------------------
// 6. Tarjetas fantasma durante fetch
// -------------------------------------------------------------
function crearFantasma() {
  const tarjeta = document.createElement("li");

  tarjeta.className = "tarjeta tarjeta--fantasma";
  tarjeta.setAttribute("aria-hidden", "true");

  const foto = document.createElement("div");
  foto.className = "fantasma__foto";

  const cuerpo = document.createElement("div");
  cuerpo.className = "fantasma__cuerpo";

  ["40%", "80%", "100%", "60%"].forEach((ancho) => {
    const linea = document.createElement("div");

    linea.className = "fantasma__linea";
    linea.style.width = ancho;

    cuerpo.append(linea);
  });

  tarjeta.append(foto, cuerpo);

  return tarjeta;
}

function mostrarFantasmas() {
  const fragmento = document.createDocumentFragment();

  for (let i = 0; i < NUM_FANTASMAS; i += 1) {
    fragmento.append(crearFantasma());
  }

  grilla.replaceChildren(fragmento);
}

// -------------------------------------------------------------
// 7. Renderizado, búsqueda y ordenamiento
// -------------------------------------------------------------
function obtenerLista() {
  const filtrados = productos.filter((producto) =>
    coincide(producto, categoriaActiva)
  );

  // sort() se aplica a una copia para no modificar el arreglo original.
  return [...filtrados].sort(
    comparadores[orden] || comparadores.defecto
  );
}

function mensajeEstado(cantidad) {
  const palabra =
    cantidad === 1 ? "producto" : "productos";

  let mensaje = `Mostrando ${cantidad} ${palabra}`;

  mensaje +=
    categoriaActiva === TODAS
      ? " en total"
      : ` en «${categoriaActiva}»`;

  if (textoBusqueda) {
    mensaje += ` que coinciden con «${buscador.value.trim()}»`;
  }

  if (soloDisponibles) {
    mensaje += " (solo disponibles)";
  }

  if (cantidad === 0) {
    mensaje += ". No se encontraron productos con esos criterios";
  }

  return `${mensaje}.`;
}

function renderizarCatalogo() {
  const lista = obtenerLista();
  const fragmento = document.createDocumentFragment();

  lista.forEach((producto) => {
    fragmento.append(crearTarjeta(producto));
  });

  grilla.replaceChildren(fragmento);
  estado.textContent = mensajeEstado(lista.length);
}

// -------------------------------------------------------------
// 8. Delegación de eventos
// -------------------------------------------------------------
contFiltros.addEventListener("click", (evento) => {
  const boton = evento.target.closest(".filtro");

  if (!boton || !contFiltros.contains(boton)) return;

  if (boton.dataset.categoria === categoriaActiva) return;

  seleccionarCategoria(boton.dataset.categoria);
});

function alCambiarControles(evento) {
  if (productos.length === 0) return;

  const id = evento.target.id;

  if (evento.type === "input" && id === "busqueda") {
    textoBusqueda = buscador.value.trim().toLowerCase();
  } else if (
    evento.type === "change" &&
    id === "orden"
  ) {
    orden = selectOrden.value;
  } else if (
    evento.type === "change" &&
    id === "solo-disponibles"
  ) {
    soloDisponibles = chkDisponibles.checked;
  } else {
    return;
  }

  actualizarContadores();
  renderizarCatalogo();
}

contControles.addEventListener(
  "input",
  alCambiarControles
);

contControles.addEventListener(
  "change",
  alCambiarControles
);

window.addEventListener("hashchange", () => {
  if (productos.length === 0) return;

  const hash = leerHash();

  // Los enlaces internos del menú no representan categorías.
  if (hash === "catalogo" || hash === "contacto") return;

  const categoriaValida = categorias.includes(hash)
    ? hash
    : TODAS;

  seleccionarCategoria(categoriaValida, false);

  if (
    categoriaValida === TODAS &&
    hash !== "" &&
    !categorias.includes(hash)
  ) {
    actualizarHash(TODAS);
  }
});

// -------------------------------------------------------------
// 9. Diálogo de detalle: delegación sobre #grilla
// -------------------------------------------------------------
function abrirDetalle(producto) {
  detImg.onerror = () => {
    detImg.onerror = null;
    detImg.src = RUTA_RESPALDO;
  };

  detImg.src = producto.imagen;
  detImg.alt = producto.nombre;

  detCategoria.textContent = producto.categoria;
  detTitulo.textContent = producto.nombre;
  detDescripcion.textContent = producto.descripcion;
  detPrecio.textContent = soles.format(producto.precio);

  detPorciones.textContent =
    producto.porciones > 1
      ? `${producto.porciones} porciones`
      : "1 unidad";

  detStock.textContent =
    producto.stock === 0
      ? "Agotado · Stock: 0"
      : `Stock: ${producto.stock} disponibles`;

  detStock.classList.toggle(
    "detalle__stock--agotado",
    producto.stock === 0
  );

  dialogo.showModal();
  detCerrar.focus();
}

grilla.addEventListener("click", (evento) => {
  const tarjeta = evento.target.closest(".tarjeta");

  if (!tarjeta) return;

  if (tarjeta.classList.contains("tarjeta--fantasma")) {
    return;
  }

  const producto = productos.find(
    (item) => item.id === Number(tarjeta.dataset.id)
  );

  if (!producto) return;

  disparadorModal = tarjeta.querySelector(".tarjeta__abrir");

  abrirDetalle(producto);
});

detCerrar.addEventListener("click", () => {
  dialogo.close();
});

dialogo.addEventListener("click", (evento) => {
  if (evento.target === dialogo) {
    dialogo.close();
  }
});

dialogo.addEventListener("close", () => {
  if (
    disparadorModal &&
    disparadorModal.isConnected
  ) {
    disparadorModal.focus();
  }

  disparadorModal = null;
});

// -------------------------------------------------------------
// 10. Mensajes de error y reintento
// -------------------------------------------------------------
function textoDeError(error) {
  switch (error.tipo) {
    case "red":
      return "No se pudo cargar el catálogo. Compruebe su conexión y abra la página con Live Server.";

    case "http":
      return error.status === 404
        ? "No se encontró el archivo de productos (error 404). Revise el nombre y la ruta data/productos.json."
        : `El servidor respondió con un error (${error.status}). Inténtelo nuevamente.`;

    case "formato":
      return "El archivo de productos está dañado o tiene un JSON incorrecto. Revise las comas y las comillas.";

    case "vacio":
      return "El catálogo no contiene productos válidos para mostrar.";

    default:
      return "Ocurrió un error inesperado al cargar el catálogo.";
  }
}

function mostrarError(error) {
  grilla.replaceChildren();
  contFiltros.replaceChildren();

  const mensaje = document.createElement("span");
  mensaje.textContent = textoDeError(error);

  const botonReintentar = document.createElement("button");

  botonReintentar.type = "button";
  botonReintentar.className = "reintentar";
  botonReintentar.textContent = "Reintentar";

  botonReintentar.addEventListener("click", iniciar);

  estado.classList.add("estado--error");
  estado.replaceChildren(mensaje, botonReintentar);
}

// -------------------------------------------------------------
// 11. Inicio de la aplicación
// -------------------------------------------------------------
async function iniciar() {
  grilla.setAttribute("aria-busy", "true");

  estado.classList.remove("estado--error");
  estado.textContent = "Cargando productos…";

  aviso.hidden = true;

  mostrarFantasmas();

  try {
    const datos = await cargarProductos();

    const resultado = validarProductos(datos);

    reportarDescartados(resultado.descartados);

    if (resultado.validos.length === 0) {
      throw crearError(
        "vacio",
        "Ningún producto válido para mostrar."
      );
    }

    productos = resultado.validos;
    categorias = obtenerCategorias(productos);

    // Se decodifica el hash y se acepta solo si existe en el JSON.
    const hashInicial = leerHash();

    categoriaActiva = categoriaDesdeHash();

    if (
      hashInicial &&
      hashInicial !== "catalogo" &&
      hashInicial !== "contacto" &&
      !categorias.includes(hashInicial)
    ) {
      actualizarHash(TODAS);
    }

    renderizarFiltros();
    renderizarCatalogo();

  } catch (error) {
    console.error(error);
    mostrarError(error);

  } finally {
    // aria-busy permanece activo hasta que los datos
    // se renderizan o se muestra el error.
    grilla.setAttribute("aria-busy", "false");
  }
}

iniciar();
