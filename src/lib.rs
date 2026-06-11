#![deny(clippy::all)]

use cn_font_proto::api_interface::{EventMessage, InputTemplate};
use cn_font_split::font_split as fp;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use prost::Message;
use std::sync::Mutex;

/// Subset/split a font.
///
/// `input` is a protobuf-encoded `InputTemplate` — the exact bytes the existing C-FFI / WASM
/// entrypoints already accept, so the JS side can keep using its current proto encoder.
///
/// Returns every streamed `EventMessage` as a protobuf-encoded `Buffer`, in emission order.
/// The final messages carry the chunked font data + the generated CSS; the JS side decodes
/// them with the same proto definitions it uses today.
#[napi]
pub fn font_split(input: Buffer) -> Result<Vec<Buffer>> {
  let config = InputTemplate::decode(input.as_ref())
    .map_err(|e| Error::from_reason(format!("failed to decode InputTemplate: {e}")))?;

  // `fp` invokes the callback synchronously on (potentially) rayon worker threads, so guard the
  // accumulator with a Mutex. Encoding to bytes inside the callback keeps `EventMessage`'s
  // lifetime contained and hands back plain owned buffers.
  let outputs: Mutex<Vec<Buffer>> = Mutex::new(Vec::new());
  fp(config, |event: EventMessage| {
    let mut bytes = Vec::with_capacity(event.encoded_len());
    event
      .encode(&mut bytes)
      .expect("failed to encode EventMessage");
    outputs.lock().unwrap().push(bytes.into());
  });

  Ok(outputs.into_inner().unwrap())
}
