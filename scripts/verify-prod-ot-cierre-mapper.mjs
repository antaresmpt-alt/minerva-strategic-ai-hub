import {
  buildProdOtProducidaInsert,
  extractCantidadProducida,
} from "../src/lib/prod-ot-cierre.ts";
import {
  PROCESO_CTP_ID,
  PROCESO_ENGOMADO_ID,
  PROCESO_OFFSET_ID,
  PROCESO_TROQUEL_ID,
} from "../src/lib/despacho-wizard-shared.ts";

function paso(procesoId, o = {}) {
  return {
    pasoId: `p${procesoId}`,
    orden: procesoId,
    estado: "finalizado",
    procesoId,
    procesoNombre: "P",
    esExterno: false,
    maquinaNombre: null,
    tipoMaquina: null,
    fechaDisponible: null,
    fechaInicio: null,
    fechaFin: null,
    datosProceso: null,
    ejecucion: null,
    externo: null,
    ...o,
  };
}

const sinEng = extractCantidadProducida([
  paso(PROCESO_CTP_ID, { datosProceso: {} }),
  paso(PROCESO_OFFSET_ID, {
    datosProceso: { hojas_impresas: 500 },
    ejecucion: {
      estado: "finalizada",
      inicioRealAt: null,
      finRealAt: null,
      horasReales: null,
      cantidadUnidades: null,
      numHojasProducidas: 500,
      maquinista: null,
      incidencia: null,
      accionCorrectiva: null,
      observaciones: null,
      numPausas: 0,
      haEstadoPausada: false,
      pausas: [],
    },
  }),
  paso(PROCESO_TROQUEL_ID, { datosProceso: { hojas_troqueladas: 475, poses: 1 } }),
  paso(15, { datosProceso: { unidades: 475 } }),
]);
if (sinEng !== 475) throw new Error(`sin engomado expected 475 got ${sinEng}`);

const conEng = extractCantidadProducida([
  paso(PROCESO_CTP_ID, {
    ejecucion: {
      estado: "finalizada",
      inicioRealAt: null,
      finRealAt: null,
      horasReales: null,
      cantidadUnidades: 0,
      numHojasProducidas: null,
      maquinista: null,
      incidencia: null,
      accionCorrectiva: null,
      observaciones: null,
      numPausas: 0,
      haEstadoPausada: false,
      pausas: [],
    },
  }),
  paso(PROCESO_ENGOMADO_ID, { datosProceso: { estuches_engomados: 6250 } }),
]);
if (conEng !== 6250) throw new Error(`engomado expected 6250 got ${conEng}`);

const row = buildProdOtProducidaInsert({
  otNumero: "36070",
  snapshot: {
    otNumero: "36070",
    otId: "x",
    cliente: "c",
    trabajo: "t",
    cantidad: 6000,
    fechaEntrega: null,
    estadoOt: null,
    despacho: null,
    pasos: [paso(PROCESO_ENGOMADO_ID, { datosProceso: { estuches_engomados: 6250 } })],
  },
  userId: "u1",
  despachoExtras: {
    referencia_id: "874b96e7-fdaf-47fb-866f-1cc847840f7c",
    referencia_minerva: "M-00701",
    referencia_cliente: "0026563",
    tipo_engomado: "Lineal",
  },
  nowIso: "2026-07-23T12:00:00.000Z",
});
if (row.referencia_minerva !== "M-00701" || row.referencia_cliente !== "0026563") {
  throw new Error(`referencia fail ${JSON.stringify(row)}`);
}

console.log("OK mapper B+C", { sinEng, conEng, ref: row.referencia_minerva });
