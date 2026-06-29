
const API_URL = 'http://localhost:3000';

const loginScreen = document.getElementById('login-screen');
const boardScreen = document.getElementById('board-screen');
const loginForm = document.getElementById('login-form');
const loginNameSelect = document.getElementById('login-name');
const loginPasswordInput = document.getElementById('login-password');
const loginErrorEl = document.getElementById('login-error');
const loginSubmitBtn = document.getElementById('login-submit-btn');

const currentUserLabel = document.getElementById('current-user-label');
const logoutBtn = document.getElementById('logout-btn');

const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const taskTitleInput = document.getElementById('task-title');
const taskDescriptionInput = document.getElementById('task-description');
const taskAssignedSelect = document.getElementById('task-assigned');
const cancelTaskBtn = document.getElementById('cancel-task-btn');

const toastEl = document.getElementById('toast');

const COLUMNAS = ['Pendiente', 'En Progreso', 'Terminado'];

function mostrarToast(mensaje, esError = false) {
  toastEl.textContent = mensaje;
  toastEl.classList.toggle('toast--error', esError);
  toastEl.classList.remove('hidden');
  clearTimeout(toastEl._timeout);
  toastEl._timeout = setTimeout(() => toastEl.classList.add('hidden'), 3000);
}

function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto || '';
  return div.innerHTML;
}

function obtenerUsuarioGuardado() {
  const datos = localStorage.getItem('kanban_user');
  return datos ? JSON.parse(datos) : null;
}

function guardarUsuario(usuario) {
  localStorage.setItem('kanban_user', JSON.stringify(usuario));
}

function borrarUsuarioGuardado() {
  localStorage.removeItem('kanban_user');
}

loginForm.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  loginErrorEl.classList.add('hidden');

  const name = loginNameSelect.value;
  const password = loginPasswordInput.value;

  if (!name || !password) {
    loginErrorEl.textContent = 'Selecciona tu nombre y escribe tu contraseña';
    loginErrorEl.classList.remove('hidden');
    return;
  }

  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = 'Entrando...';

  try {
    const respuesta = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      loginErrorEl.textContent = datos.error || 'Usuario o contraseña incorrectos';
      loginErrorEl.classList.remove('hidden');
      return;
    }

    guardarUsuario(datos.user);
    mostrarTablero(datos.user);
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    loginErrorEl.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo.';
    loginErrorEl.classList.remove('hidden');
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = 'Entrar';
  }
});

logoutBtn.addEventListener('click', () => {
  borrarUsuarioGuardado();
  boardScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  loginForm.reset();
});

function mostrarTablero(usuario) {
  loginScreen.classList.add('hidden');
  boardScreen.classList.remove('hidden');
  currentUserLabel.textContent = `Hola, ${usuario.name}`;
  cargarTareas();
}

async function cargarTareas() {
  try {
    const respuesta = await fetch(`${API_URL}/tasks`);
    if (!respuesta.ok) throw new Error('No se pudieron obtener las tareas');
    const tareas = await respuesta.json();
    renderizarTablero(tareas);
  } catch (error) {
    console.error('Error al cargar tareas:', error);
    mostrarToast('No se pudieron cargar las tareas', true);
  }
}

function renderizarTablero(tareas) {
  
  COLUMNAS.forEach((columna) => {
    document.getElementById(`list-${columna}`).innerHTML = '';
  });

  tareas.forEach((tarea) => agregarTarjetaAlDOM(tarea));
  actualizarContadores();
}

function actualizarContadores() {
  COLUMNAS.forEach((columna) => {
    const lista = document.getElementById(`list-${columna}`);
    document.getElementById(`count-${columna}`).textContent = lista.children.length;
  });
}

function crearElementoTarjeta(tarea) {
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = true;
  card.dataset.id = tarea.id;
  card.dataset.column = tarea.column_name;

  const inicial = tarea.assigned_to ? tarea.assigned_to.charAt(0).toUpperCase() : '?';

  card.innerHTML = `
    <button class="card-delete" title="Eliminar tarea" aria-label="Eliminar tarea">×</button>
    <h3 class="card-title">${escaparHTML(tarea.title)}</h3>
    ${tarea.description ? `<p class="card-description">${escaparHTML(tarea.description)}</p>` : ''}
    <div class="card-footer">
      <span class="avatar avatar--${escaparHTML(tarea.assigned_to)}">${inicial}</span>
      <span class="assigned-name">${escaparHTML(tarea.assigned_to)}</span>
    </div>
  `;
  
  card.addEventListener('dragstart', () => {
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  card.querySelector('.card-delete').addEventListener('click', () => eliminarTarea(tarea.id, card));

  return card;
}

function agregarTarjetaAlDOM(tarea) {
  const lista = document.getElementById(`list-${tarea.column_name}`);
  if (lista) {
    lista.appendChild(crearElementoTarjeta(tarea));
  }
}

document.querySelectorAll('.card-list').forEach((lista) => {
  lista.addEventListener('dragover', (evento) => {
    evento.preventDefault();
    lista.classList.add('drag-over');
  });

  lista.addEventListener('dragleave', () => {
    lista.classList.remove('drag-over');
  });

  lista.addEventListener('drop', async (evento) => {
    evento.preventDefault();
    lista.classList.remove('drag-over');

    const card = document.querySelector('.card.dragging');
    if (!card) return;

    const columnaAnterior = card.dataset.column;
    const columnaNueva = lista.dataset.column;

    lista.appendChild(card);
    card.dataset.column = columnaNueva;
    actualizarContadores();

    if (columnaAnterior === columnaNueva) return;

    try {
      const respuesta = await fetch(`${API_URL}/tasks/${card.dataset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_name: columnaNueva }),
      });

      if (!respuesta.ok) throw new Error('No se pudo actualizar la tarea');
    } catch (error) {
      console.error('Error al mover la tarea:', error);
      mostrarToast('No se pudo mover la tarea, recargando tablero...', true);
      cargarTareas();
    }
  });
});

addTaskBtn.addEventListener('click', () => {
  taskForm.reset();
  taskModal.classList.remove('hidden');
  taskTitleInput.focus();
});

cancelTaskBtn.addEventListener('click', () => {
  taskModal.classList.add('hidden');
});

taskModal.addEventListener('click', (evento) => {
  if (evento.target === taskModal) taskModal.classList.add('hidden');
});

taskForm.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const nuevaTarea = {
    title: taskTitleInput.value.trim(),
    description: taskDescriptionInput.value.trim(),
    assigned_to: taskAssignedSelect.value,
    column_name: 'Pendiente',
  };

  if (!nuevaTarea.title) {
    mostrarToast('El título es obligatorio', true);
    return;
  }

  try {
    const respuesta = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevaTarea),
    });

    if (!respuesta.ok) throw new Error('No se pudo crear la tarea');

    const tareaCreada = await respuesta.json();
    agregarTarjetaAlDOM(tareaCreada);
    actualizarContadores();

    taskModal.classList.add('hidden');
    mostrarToast('Tarea agregada correctamente');
  } catch (error) {
    console.error('Error al crear tarea:', error);
    mostrarToast('No se pudo crear la tarea', true);
  }
});

async function eliminarTarea(id, card) {
  const confirmar = confirm('¿Seguro que quieres eliminar esta tarea?');
  if (!confirmar) return;

  try {
    const respuesta = await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
    if (!respuesta.ok) throw new Error('No se pudo eliminar la tarea');

    card.remove();
    actualizarContadores();
    mostrarToast('Tarea eliminada');
  } catch (error) {
    console.error('Error al eliminar tarea:', error);
    mostrarToast('No se pudo eliminar la tarea', true);
  }
}

(function iniciar() {
  const usuarioGuardado = obtenerUsuarioGuardado();
  if (usuarioGuardado) {
    mostrarTablero(usuarioGuardado);
  }
})();