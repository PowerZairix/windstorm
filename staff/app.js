(function () {
    const $ = (id) => document.getElementById(id);
    const pantallas = ['pantalla-cargando', 'pantalla-login', 'pantalla-panel'];
    function mostrar(id) {
        pantallas.forEach((p) => { $(p).hidden = p !== id; });
    }
 
    const ERRORES = {
        estado_invalido: 'Algo no cuadró con Discord, intenta iniciar sesión de nuevo.',
        token: 'Discord no aceptó la solicitud, intenta de nuevo.',
        usuario: 'No se pudo leer tu cuenta de Discord.',
        miembro: 'No se pudo comprobar tu membresía del servidor.',
        no_esta_en_el_server: 'Tu cuenta de Discord no está en el servidor de WindStorm.',
        sin_rol: 'Tu cuenta está en el servidor, pero no tienes ningún rol de staff asignado.',
        inesperado: 'Algo salió mal. Intenta de nuevo en un momento.',
    };
 
    const AUDIENCIAS = {
        all: 'Todo el staff',
        admin: 'Admins',
        constructor: 'Constructores',
        programador: 'Programadores',
        moderacion: 'Moderación',
        tester: 'Testers',
    };
 
    const POR_PAGINA = 8;
    const CHEVRON = '<svg class="note-chev" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 
    let usuario = null;
    let notas = [];
    let filtro = 'all';
    let visibles = POR_PAGINA;
 
    // Crea elementos del DOM sin usar innerHTML con texto de usuarios
    function h(tag, props, ...hijos) {
        const el = document.createElement(tag);
        Object.entries(props || {}).forEach(([k, v]) => {
            if (v === false || v == null) return;
            if (k === 'class') el.className = v;
            else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else el.setAttribute(k, v === true ? '' : v);
        });
        hijos.flat().forEach((c) => { if (c != null) el.append(c); });
        return el;
    }
 
    function fechaCorta(iso) {
        return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
 
    function soloFecha(iso) {
        return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    }
 
    // ---------- Sesión ----------
    async function cargarSesion() {
        const error = new URLSearchParams(location.search).get('error');
 
        const res = await fetch('/api/session');
        const data = await res.json();
 
        if (!data.authenticated) {
            mostrar('pantalla-login');
            if (error) {
                const el = $('login-error');
                el.textContent = ERRORES[error] || ERRORES.inesperado;
                el.hidden = false;
            }
            return;
        }
 
        usuario = data.user;
        mostrar('pantalla-panel');
        $('user-nombre').textContent = usuario.username;
        $('badge-dinamico').textContent = usuario.roleLabel;
        $('user-avatar').src = usuario.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
        cargarNotas();
    }
 
    // ---------- Notas ----------
    async function cargarNotas() {
        const cont = $('lista-notas');
        cont.replaceChildren(h('p', { class: 'hint' }, 'Cargando notas…'));
 
        const res = await fetch('/api/notes');
        if (!res.ok) {
            cont.replaceChildren(h('p', { class: 'hint' }, 'No se pudieron cargar las notas.'));
            return;
        }
        notas = (await res.json()).notes;
        pintar();
    }
 
    function pintar() {
        const cont = $('lista-notas');
        const sinLeer = notas.filter((n) => !n.read).length;
        $('cuenta-todas').textContent = notas.length;
        $('cuenta-sinleer').textContent = sinLeer;
 
        const lista = filtro === 'unread' ? notas.filter((n) => !n.read) : notas;
 
        if (lista.length === 0) {
            const msg = filtro === 'unread' ? 'No tienes notas sin leer.' : 'Todavía no hay notas.';
            cont.replaceChildren(h('p', { class: 'hint' }, msg));
            $('btn-mas').hidden = true;
            return;
        }
 
        cont.replaceChildren(...lista.slice(0, visibles).map(renderNota));
        $('btn-mas').hidden = lista.length <= visibles;
    }
 
    function renderNota(nota) {
        const readers = nota.readers || [];
        const audiencia = AUDIENCIAS[nota.audience] || nota.audience;
 
        const cabecera = h('button', { type: 'button', class: 'note-head', 'aria-expanded': 'false' },
            h('span', { class: 'note-dot', title: nota.read ? '' : 'Sin leer' }),
            h('span', { class: 'note-main' },
                h('span', { class: 'note-title' }, nota.title),
                h('span', { class: 'note-preview' }, nota.body.replace(/\s+/g, ' '))
            ),
            h('span', { class: 'note-side' },
                h('span', { class: 'pill' }, audiencia),
                h('span', { class: 'note-date' }, soloFecha(nota.created_at))
            )
        );
        cabecera.insertAdjacentHTML('beforeend', CHEVRON);
 
        const lectores = h('div', { class: 'readers', hidden: true });
        const btnVistos = h('button', { type: 'button', class: 'link-btn' });
        const textoVistos = () => { btnVistos.textContent = `👁 Visto por ${(nota.readers || []).length}`; };
        textoVistos();
 
        function pintarLectores() {
            const r = nota.readers || [];
            lectores.replaceChildren(...(r.length
                ? r.map((x) => h('span', { class: 'chip' }, x.username, ' ', h('span', null, '· ' + fechaCorta(x.read_at))))
                : [h('span', { class: 'empty' }, 'Nadie la ha visto todavía')]));
        }
        pintarLectores();
 
        btnVistos.addEventListener('click', () => { lectores.hidden = !lectores.hidden; });
 
        const acciones = h('div', { class: 'note-foot-actions' }, btnVistos);
        if (nota.canDelete) {
            acciones.append(h('button', { type: 'button', class: 'link-btn danger', onclick: () => borrarNota(nota.id) }, '🗑 Borrar'));
        }
 
        const cuerpo = h('div', { class: 'note-body', hidden: true },
            h('div', { class: 'note-meta-mobile' }, `${audiencia} · ${soloFecha(nota.created_at)}`),
            h('div', { class: 'note-text' }, nota.body),
            h('div', { class: 'note-foot' },
                h('span', null, `Por ${nota.created_by} · ${fechaCorta(nota.created_at)}`),
                acciones
            ),
            lectores
        );
 
        const fila = h('div', { class: 'note' + (nota.read ? '' : ' unread'), 'data-id': nota.id }, cabecera, cuerpo);
 
        cabecera.addEventListener('click', () => {
            const abrir = cuerpo.hidden;
            cuerpo.hidden = !abrir;
            fila.classList.toggle('open', abrir);
            cabecera.setAttribute('aria-expanded', String(abrir));
            if (abrir && !nota.read) marcarVista(nota, fila, pintarLectores, textoVistos);
        });
 
        return fila;
    }
 
    // Se marca como vista solo cuando la abres
    async function marcarVista(nota, fila, pintarLectores, textoVistos) {
        const res = await fetch('/api/notes-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ noteId: nota.id }),
        });
        if (!res.ok) return;
 
        nota.read = true;
        nota.readers = (nota.readers || []).concat({ username: usuario.username, read_at: new Date().toISOString() });
        fila.classList.remove('unread');
        fila.querySelector('.note-dot').removeAttribute('title');
        pintarLectores();
        textoVistos();
        $('cuenta-sinleer').textContent = notas.filter((n) => !n.read).length;
    }
 
    async function borrarNota(id) {
        if (!confirm('¿Borrar esta nota? No se puede deshacer.')) return;
 
        const res = await fetch('/api/notes?id=' + id, { method: 'DELETE' });
        if (!res.ok) {
            alert('No se pudo borrar la nota.');
            return;
        }
        notas = notas.filter((n) => n.id !== id);
        pintar();
    }
 
    // ---------- Filtros y "mostrar más" ----------
    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            filtro = tab.dataset.filtro;
            visibles = POR_PAGINA;
            document.querySelectorAll('.tab').forEach((t) => {
                const activo = t === tab;
                t.classList.toggle('is-active', activo);
                t.setAttribute('aria-selected', String(activo));
            });
            pintar();
        });
    });
 
    $('btn-mas').addEventListener('click', () => { visibles += POR_PAGINA; pintar(); });
 
    // ---------- Ventana de "Nueva nota" ----------
    let audienciaSeleccionada = 'all';
    const composer = $('composer');
 
    function initDropdownAudiencia() {
        const dropdown = $('audiencia-dropdown');
        const toggle = $('audiencia-toggle');
        const menu = $('audiencia-menu');
        const actual = $('audiencia-actual');
 
        function cerrar() {
            menu.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
        }
 
        toggle.addEventListener('click', () => {
            menu.hidden = !menu.hidden;
            toggle.setAttribute('aria-expanded', String(!menu.hidden));
        });
 
        menu.querySelectorAll('.dropdown-option').forEach((opt) => {
            opt.addEventListener('click', () => {
                audienciaSeleccionada = opt.dataset.value;
                actual.textContent = opt.textContent;
                menu.querySelectorAll('.dropdown-option').forEach((o) => {
                    o.classList.toggle('is-selected', o === opt);
                    o.setAttribute('aria-selected', String(o === opt));
                });
                cerrar();
            });
        });
 
        document.addEventListener('click', (e) => { if (!dropdown.contains(e.target)) cerrar(); });
        composer.addEventListener('close', cerrar);
    }
 
    function abrirComposer() {
        $('nota-error').hidden = true;
        composer.showModal();
        $('nota-titulo').focus();
    }
 
    async function publicarNota() {
        const title = $('nota-titulo').value.trim();
        const body = $('nota-cuerpo').value.trim();
        const errorEl = $('nota-error');
        errorEl.hidden = true;
 
        if (!title || !body) {
            errorEl.textContent = 'Escribe un título y el contenido de la nota.';
            errorEl.hidden = false;
            return;
        }
 
        const res = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body, audience: audienciaSeleccionada }),
        });
 
        if (!res.ok) {
            errorEl.textContent = 'No se pudo publicar la nota, intenta de nuevo.';
            errorEl.hidden = false;
            return;
        }
 
        const { note } = await res.json();
        notas.unshift(note);
        $('nota-titulo').value = '';
        $('nota-cuerpo').value = '';
        composer.close();
        filtro = 'all';
        document.querySelectorAll('.tab').forEach((t) => {
            const activo = t.dataset.filtro === 'all';
            t.classList.toggle('is-active', activo);
            t.setAttribute('aria-selected', String(activo));
        });
        pintar();
    }
 
    $('btn-nueva').addEventListener('click', abrirComposer);
    $('btn-cancelar').addEventListener('click', () => composer.close());
    $('btn-publicar').addEventListener('click', publicarNota);
    $('btn-salir').addEventListener('click', () => { location.href = '/api/auth/logout'; });
 
    initDropdownAudiencia();
    cargarSesion();
})();
 