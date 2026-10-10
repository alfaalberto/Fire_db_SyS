import { slideBridgeRuntime } from './slide-bridge.runtime';

/**
 * Código del puente listo para incrustarse en un `<script>` del `srcdoc`.
 * Se obtiene del texto de la función (ya minificada en producción), así el
 * puente se escribe, revisa y compila como código normal. El envoltorio
 * restablece el modo estricto, que el minificador elimina por redundante.
 */
export const SLIDE_BRIDGE_SOURCE = `(function(){'use strict';(${slideBridgeRuntime.toString()})();})();`;
