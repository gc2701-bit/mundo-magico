/* precios.js — leyenda "quedan pocas unidades". Prueba puntual de
 * marcarPocasUnidades(), no todo el pipeline de pintar/resolver precios
 * (eso queda cubierto por los e2e existentes de cart-whatsapp-flow.spec.js
 * y smoke.spec.js, que ya ejercitan precios.js contra un catálogo real).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScript } from '../helpers/loadScript.js';

function montarProducto() {
  window.MMProducto = {
    codigoDeImagen: function () { return ''; },
    leerTalles: function () { return null; },
    leerIncluye: function () { return null; }
  };
}

// precios.js sólo arma window.MMPrecios (con marcarPocasUnidades adentro)
// dentro de aplicar(), que arrancar() dispara vía MMCatalogo.cargar() — y
// sólo si hay al menos un código con precio (si no, arrancar() corta antes
// de llegar a aplicar(), ver el comentario de cabecera de ese archivo). Sin
// este mock, window.MMPrecios queda undefined y el test no puede ejercitar
// marcarPocasUnidades sin duplicar todo el pipeline de aplicar().
function montarCatalogo() {
  window.MMCatalogo = {
    cargar: function (cb) {
      cb({
        precios: { '00000': 100 },
        fotos: {},
        origen: 'test',
        sinStock: {},
        pocasUnidades: {},
        tarjetas: {},
        subcategorias: {}
      });
    }
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  delete window.MMCatalogo;
  montarProducto();
  montarCatalogo();
});

describe('precios.js — marca data-pocas-unidades en la tarjeta según el set del catálogo', () => {
  it('código con pocas unidades: marca data-pocas-unidades="1"', () => {
    loadScript('assets/precios.js');
    document.body.innerHTML =
      '<a class="pcard" data-pos="04375" data-pos-ok="04375">' +
      '<div class="pcard-ph"><img src="x.jpg"></div><div class="pcard-body"><h3>Test</h3></div></a>';
    const card = document.querySelector('.pcard');

    window.MMPrecios.marcarPocasUnidades(card, { '04375': true });
    expect(card.getAttribute('data-pocas-unidades')).toBe('1');
  });

  it('código sin pocas unidades: no marca nada', () => {
    loadScript('assets/precios.js');
    document.body.innerHTML =
      '<a class="pcard" data-pos="04375" data-pos-ok="04375">' +
      '<div class="pcard-ph"><img src="x.jpg"></div><div class="pcard-body"><h3>Test</h3></div></a>';
    const card = document.querySelector('.pcard');

    window.MMPrecios.marcarPocasUnidades(card, {});
    expect(card.hasAttribute('data-pocas-unidades')).toBe(false);
  });

  it('tarjeta ya marcada, código dejó de estar en pocasUnidades: saca la marca (reversible)', () => {
    loadScript('assets/precios.js');
    document.body.innerHTML =
      '<a class="pcard" data-pos-ok="04375" data-pocas-unidades="1">' +
      '<div class="pcard-ph"><img src="x.jpg"></div><div class="pcard-body"><h3>Test</h3></div></a>';
    const card = document.querySelector('.pcard');

    window.MMPrecios.marcarPocasUnidades(card, {});
    expect(card.hasAttribute('data-pocas-unidades')).toBe(false);
  });
});
