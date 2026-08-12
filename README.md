# Mochila Peru

Checklist familiar de emergencia adaptado a la realidad peruana. Calcula una mochila de emergencia y caja de reserva segun zona, riesgos, composicion del hogar y dias de autonomia.

Este proyecto es un fork MIT de [`readykit`](https://github.com/Sreenivas-Sadhu-Prabhakara/readykit).

## Que cambia frente al original

- Presets peruanos por zona: Lima/costa, costa norte, sierra, selva y sur volcanico.
- Riesgos locales: sismo, tsunami, huaico/deslizamiento, lluvias/inundacion, helada/friaje, ceniza volcanica, incendio y corte de agua/luz.
- Checklist en espanol peruano, con referencias a INDECI, COEN, SENAMHI, IGP, CENEPRED, Minsa, Bomberos 116, Policia 105 y SAMU 106.
- Diseno mas sobrio y utilitario: la herramienta aparece en la primera pantalla, sin hero generico ni decoracion de plantilla.
- Sigue siendo 100% estatica, privada y offline: no hay backend, cuentas, analytics ni llamadas de red.

## Uso local

Abre `index.html` directamente en el navegador, o sirve la carpeta con cualquier servidor estatico:

```bash
npx serve .
```

Los checks se guardan en `localStorage`, en el navegador del usuario.

## Despliegue recomendado: Cloudflare Pages

La app no necesita build.

1. En Cloudflare, entra a **Workers & Pages**.
2. Crea un proyecto de **Pages** conectado a `gumorenos/mochila-peru`.
3. Configuracion:
   - Framework preset: `None`
   - Build command: vacio
   - Build output directory: `/`
4. Publica.

Luego puedes agregar un dominio tipo `mochila.gumorenos.space` desde **Custom domains**.

## Alternativas

- GitHub Pages: servir desde `main` / root.
- Netlify o Vercel: proyecto estatico sin build.
- Servidor propio: copiar los archivos y servirlos con Nginx/Caddy.

## Pendientes razonables

- Reemplazar imagenes `preview.png` y `og-image.png` por graficas propias de la version peruana.
- Agregar fuentes/enlaces visibles por item si se quiere una version mas institucional.
- Agregar service worker si se quiere instalacion PWA offline despues de la primera visita.
- Revisar el contenido con alguien de gestion de riesgos o seguridad civil antes de publicarlo ampliamente.

## Licencia

MIT. Mantiene credito al proyecto original segun la licencia incluida.
