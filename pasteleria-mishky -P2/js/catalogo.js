// =============================================================
// Pastelería Mishky · Catálogo dinámico + Mesa Dulce Interactiva
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

// Elementos del diálogo de detalle
const dialogo = document.querySelector("#detalle");
const detImg = document.querySelector("#detalle-img");
const detCategoria = document.querySelector("#detalle-categoria");
const detTitulo = document.querySelector("#detalle-titulo");
const detDescripcion = document.querySelector("#detalle-descripcion");
const detPrecio = document.querySelector("#detalle-precio");
const detPorciones = document.querySelector("#detalle-porciones");
const detStock = document.querySelector("#detalle-stock");
const detCerrar = document.querySelector("#detalle-cerrar");
const detAgregar = document.querySelector("#detalle-agregar");

// Elementos de la Mesa Dulce interactiva
const btnAbrirMesa = document.querySelector("#abrir-mesa-dulce");
const resumenContador = document.querySelector("#resumen-contador");
const barraMesa = document.querySelector("#barra-mesa");
const barraMesaDetalle = document.querySelector("#barra-mesa-detalle");
const barraMesaAbrir = document.querySelector("#barra-mesa-abrir");
const barraMesaLimpiar = document.querySelector("#barra-mesa-limpiar");

const dialogoMesa = document.querySelector("#mesa-dulce");
const mesaCerrar = document.querySelector("#mesa-cerrar");
const selectEvento = document.querySelector("#tipo-evento");
const inputInvitados = document.querySelector("#invitados-estimados");
const mesaCatalogoLista = document.querySelector("#mesa-catalogo-lista");
const mesaSeleccionLista = document.querySelector("#mesa-seleccion-lista");
const metricaItems = document.querySelector("#metrica-items");
const metricaPorciones = document.querySelector("#metrica-porciones");
const metricaCobertura = document.querySelector("#metrica-cobertura");
const metricaSubtotal = document.querySelector("#metrica-subtotal");
const metricaDescuento = document.querySelector("#metrica-descuento");
const metricaTotal = document.querySelector("#metrica-total");
const btnCopiarResumen = document.querySelector("#copiar-resumen");
const btnLimpiarMesa = document.querySelector("#limpiar-mesa");
const mensajeCopiado = document.querySelector("#mensaje-copiado");

// Estado de la aplicación
let productos = [];
let categorias = [];
let categoriaActiva = TODAS;
let textoBusqueda = "";
let orden = "defecto";
let soloDisponibles = false;
let disparadorModal = null;
let productoActualModal = null;

// Mapa idProducto -> cantidad seleccionada
const seleccionMesa = new Map();

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
  const btnAgregar = nodo.querySelector(".btn-agregar-rapido");

  tarjeta.dataset.id = producto.id;

  imagen.alt = producto.nombre;
  imagen.loading = "lazy";
  imagen.decoding = "async";

  imagen.sizes =
    "(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 280px";

  imagen.addEventListener(
    "load",
    () => {
      imagen.classList.add("foto-cargada");
    },
    { once: true }
  );

  imagen.addEventListener("error", () => {
    if (imagen.dataset.respaldoUsado === "true") return;

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
    btnAgregar.disabled = true;
    btnAgregar.textContent = "Sin stock";
  } else {
    btnAgregar.dataset.id = producto.id;
    if (producto.destacado) {
      etiqueta.textContent = "Favorito";
      etiqueta.hidden = false;
    }
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
  productoActualModal = producto;

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

  detAgregar.disabled = producto.stock === 0;
  detAgregar.textContent =
    producto.stock === 0
      ? "Sin stock disponible"
      : "Agregar a mi Mesa Dulce";

  dialogo.showModal();
  detCerrar.focus();
}

grilla.addEventListener("click", (evento) => {
  const btnRapido = evento.target.closest(".btn-agregar-rapido");
  if (btnRapido) {
    evento.stopPropagation();
    const id = Number(btnRapido.dataset.id);
    const prod = productos.find((item) => item.id === id);
    if (prod) {
      agregarAMesa(prod.id);
    }
    return;
  }

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

detAgregar.addEventListener("click", () => {
  if (!productoActualModal || productoActualModal.stock <= 0) return;
  agregarAMesa(productoActualModal.id);
  dialogo.close();
  abrirMesaDulce();
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
  productoActualModal = null;
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
// 12. Innovación: Creador de Mesa Dulce y Cálculo Inteligente
// -------------------------------------------------------------
function calcularMetricasMesa() {
  let totalItems = 0;
  let totalPorciones = 0;
  let subtotal = 0;

  seleccionMesa.forEach((cantidad, id) => {
    const prod = productos.find((item) => item.id === id);
    if (!prod || cantidad <= 0) return;

    totalItems += cantidad;
    totalPorciones += prod.porciones * cantidad;
    subtotal += prod.precio * cantidad;
  });

  // Descuento progresivo por cantidad de ítems elegidos
  let tasaDescuento = 0;
  if (totalItems >= 6) {
    tasaDescuento = 0.1;
  } else if (totalItems >= 3) {
    tasaDescuento = 0.05;
  }

  const montoDescuento = subtotal * tasaDescuento;
  const totalFinal = Math.max(0, subtotal - montoDescuento);

  const invitados = Math.max(1, Number(inputInvitados?.value) || 1);
  const coberturaPorcentaje = Math.min(
    100,
    Math.round((totalPorciones / invitados) * 100)
  );

  return {
    totalItems,
    totalPorciones,
    subtotal,
    tasaDescuento,
    montoDescuento,
    totalFinal,
    invitados,
    coberturaPorcentaje
  };
}

function agregarAMesa(idProducto) {
  const prod = productos.find((item) => item.id === idProducto);
  if (!prod || prod.stock <= 0) return;

  const actual = seleccionMesa.get(idProducto) || 0;
  if (actual >= prod.stock) return;

  seleccionMesa.set(idProducto, actual + 1);
  sincronizarInterfazMesa();
}

function cambiarCantidadMesa(idProducto, delta) {
  const prod = productos.find((item) => item.id === idProducto);
  if (!prod) return;

  const actual = seleccionMesa.get(idProducto) || 0;
  const nuevaCantidad = actual + delta;

  if (nuevaCantidad <= 0) {
    seleccionMesa.delete(idProducto);
  } else if (nuevaCantidad <= prod.stock) {
    seleccionMesa.set(idProducto, nuevaCantidad);
  }

  sincronizarInterfazMesa();
}

function limpiarMesa() {
  seleccionMesa.clear();
  if (mensajeCopiado) mensajeCopiado.textContent = "";
  sincronizarInterfazMesa();
}

function renderizarCatalogoEnMesa() {
  if (!mesaCatalogoLista) return;

  const disponibles = productos.filter((prod) => prod.stock > 0);
  const fragmento = document.createDocumentFragment();

  disponibles.forEach((prod) => {
    const li = document.createElement("li");
    li.className = "mesa-item";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${prod.nombre}</strong><br><small>${soles.format(prod.precio)} · ${prod.porciones} porc. · Stock: ${prod.stock}</small>`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-mini";
    btn.textContent = "+ Añadir";
    const enMesa = seleccionMesa.get(prod.id) || 0;
    btn.disabled = enMesa >= prod.stock;

    btn.addEventListener("click", () => agregarAMesa(prod.id));

    li.append(info, btn);
    fragmento.append(li);
  });

  mesaCatalogoLista.replaceChildren(fragmento);
}

function renderizarSeleccionEnMesa() {
  if (!mesaSeleccionLista) return;

  const fragmento = document.createDocumentFragment();

  if (seleccionMesa.size === 0) {
    const vacio = document.createElement("li");
    vacio.className = "mesa-vacio";
    vacio.textContent = "Aún no agregaste dulces a tu mesa.";
    fragmento.append(vacio);
  } else {
    seleccionMesa.forEach((cantidad, id) => {
      const prod = productos.find((item) => item.id === id);
      if (!prod) return;

      const li = document.createElement("li");
      li.className = "mesa-item";

      const info = document.createElement("div");
      info.innerHTML = `<strong>${prod.nombre}</strong><br><small>${soles.format(prod.precio * cantidad)} (${prod.porciones * cantidad} porc.)</small>`;

      const controles = document.createElement("div");
      controles.className = "mesa-controles-cant";

      const btnMenos = document.createElement("button");
      btnMenos.type = "button";
      btnMenos.className = "btn-mini";
      btnMenos.textContent = "−";
      btnMenos.setAttribute("aria-label", `Restar uno de ${prod.nombre}`);
      btnMenos.addEventListener("click", () => cambiarCantidadMesa(prod.id, -1));

      const cantSpan = document.createElement("span");
      cantSpan.textContent = String(cantidad);

      const btnMas = document.createElement("button");
      btnMas.type = "button";
      btnMas.className = "btn-mini";
      btnMas.textContent = "+";
      btnMas.disabled = cantidad >= prod.stock;
      btnMas.setAttribute("aria-label", `Sumar uno de ${prod.nombre}`);
      btnMas.addEventListener("click", () => cambiarCantidadMesa(prod.id, 1));

      controles.append(btnMenos, cantSpan, btnMas);
      li.append(info, controles);
      fragmento.append(li);
    });
  }

  mesaSeleccionLista.replaceChildren(fragmento);
}

function sincronizarInterfazMesa() {
  const m = calcularMetricasMesa();

  if (resumenContador) {
    resumenContador.textContent = String(m.totalItems);
  }

  if (barraMesa) {
    barraMesa.hidden = m.totalItems === 0;
    if (barraMesaDetalle) {
      barraMesaDetalle.textContent = `${m.totalItems} ítem(s) · ${m.totalPorciones} porciones · Total: ${soles.format(m.totalFinal)}`;
    }
  }

  if (metricaItems) metricaItems.textContent = String(m.totalItems);
  if (metricaPorciones) metricaPorciones.textContent = String(m.totalPorciones);
  if (metricaCobertura) metricaCobertura.textContent = `${m.coberturaPorcentaje}% (${m.totalPorciones}/${m.invitados} porc.)`;
  if (metricaSubtotal) metricaSubtotal.textContent = soles.format(m.subtotal);
  if (metricaDescuento) {
    metricaDescuento.textContent = `−${soles.format(m.montoDescuento)} (${Math.round(m.tasaDescuento * 100)}%)`;
  }
  if (metricaTotal) metricaTotal.textContent = soles.format(m.totalFinal);

  renderizarCatalogoEnMesa();
  renderizarSeleccionEnMesa();
}

function abrirMesaDulce() {
  if (!dialogoMesa) return;
  sincronizarInterfazMesa();
  dialogoMesa.showModal();
  mesaCerrar?.focus();
}

async function copiarResumenPedido() {
  const m = calcularMetricasMesa();
  if (m.totalItems === 0) {
    if (mensajeCopiado) {
      mensajeCopiado.textContent = "Agrega al menos un producto para generar el resumen.";
    }
    return;
  }

  const eventoTexto = selectEvento?.selectedOptions[0]?.textContent || "Pedido personalizado";
  const lineas = [
    "PASTELERÍA MISHKY · RESUMEN DE MESA DULCE",
    `Ocasión: ${eventoTexto}`,
    `Invitados estimados: ${m.invitados}`,
    "Detalle:"
  ];

  seleccionMesa.forEach((cantidad, id) => {
    const prod = productos.find((item) => item.id === id);
    if (prod) {
      lineas.push(`- ${cantidad}x ${prod.nombre} (${soles.format(prod.precio * cantidad)})`);
    }
  });

  lineas.push(`Porciones estimadas: ${m.totalPorciones}`);
  lineas.push(`Subtotal: ${soles.format(m.subtotal)}`);
  if (m.tasaDescuento > 0) {
    lineas.push(`Descuento (${Math.round(m.tasaDescuento * 100)}%): -${soles.format(m.montoDescuento)}`);
  }
  lineas.push(`TOTAL ESTIMADO: ${soles.format(m.totalFinal)}`);

  const textoFinal = lineas.join("\n");

  try {
    await navigator.clipboard.writeText(textoFinal);
    if (mensajeCopiado) {
      mensajeCopiado.textContent = "Resumen copiado al portapapeles listo para enviar.";
    }
  } catch {
    if (mensajeCopiado) {
      mensajeCopiado.textContent = "No se pudo copiar automáticamente; revisa el permiso del navegador.";
    }
  }
}

btnAbrirMesa?.addEventListener("click", abrirMesaDulce);
barraMesaAbrir?.addEventListener("click", abrirMesaDulce);
barraMesaLimpiar?.addEventListener("click", limpiarMesa);
btnLimpiarMesa?.addEventListener("click", limpiarMesa);
btnCopiarResumen?.addEventListener("click", copiarResumenPedido);
inputInvitados?.addEventListener("input", sincronizarInterfazMesa);
selectEvento?.addEventListener("change", () => {
  const sugerencias = {
    antojo: 3,
    cumpleanos: 10,
    reunion: 20,
    "mesa-cusco": 35
  };
  if (inputInvitados && sugerencias[selectEvento.value]) {
    inputInvitados.value = String(sugerencias[selectEvento.value]);
  }
  sincronizarInterfazMesa();
});

mesaCerrar?.addEventListener("click", () => {
  dialogoMesa?.close();
});

dialogoMesa?.addEventListener("click", (evento) => {
  if (evento.target === dialogoMesa) {
    dialogoMesa.close();
  }
});

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
    sincronizarInterfazMesa();

  } catch (error) {
    console.error(error);
    mostrarError(error);

  } finally {
    grilla.setAttribute("aria-busy", "false");
  }
}

iniciar();