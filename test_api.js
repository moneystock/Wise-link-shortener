const http = require('http');

async function runTests() {
  const baseUrl = 'http://127.0.0.1:3000';
  console.log('--- Iniciando Pruebas de Integración de la API ---');

  const testSlug = `test-wise-${Date.now().toString().slice(-4)}`;

  // 1. Crear enlace Wise con alias personalizado
  console.log(`\n1. Test: Crear enlace Wise con alias personalizado (${testSlug})...`);
  const postWise = await fetch(`${baseUrl}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      original_url: 'https://wisemarketing.agency/servicios',
      short_code: testSlug,
      workspace: 'wise'
    })
  });
  const wiseData = await postWise.json();
  console.log('Status:', postWise.status);
  console.log('Respuesta:', wiseData);
  if (!wiseData.success || wiseData.data.short_code !== testSlug) {
    throw new Error('Fallo al crear enlace de Wise');
  }

  // 2. Crear enlace Onclusive con código aleatorio
  console.log('\n2. Test: Crear enlace Onclusive con código automático...');
  const postOnclusive = await fetch(`${baseUrl}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      original_url: 'https://onclusive.com/media-monitoring',
      workspace: 'onclusive'
    })
  });
  const onclusiveData = await postOnclusive.json();
  console.log('Status:', postOnclusive.status);
  console.log('Respuesta:', onclusiveData);
  if (!onclusiveData.success || onclusiveData.data.workspace !== 'onclusive') {
    throw new Error('Fallo al crear enlace de Onclusive');
  }

  // 3. Probar redirección HTTP 302 y registro de clic
  console.log(`\n3. Test: Probar redirección pública (GET /${testSlug})...`);
  const redirectRes = await fetch(`${baseUrl}/${testSlug}`, {
    redirect: 'manual' // Evitar seguir la redirección para validar el 302
  });
  console.log('Status de redirección:', redirectRes.status);
  console.log('Location header:', redirectRes.headers.get('location'));
  if (redirectRes.status !== 302 || redirectRes.headers.get('location') !== 'https://wisemarketing.agency/servicios') {
    throw new Error('La redirección 302 falló');
  }

  // 4. Consultar detalle del enlace para verificar que se incrementó el clic y se registró en clicks_log
  console.log('\n4. Test: Consultar detalle del enlace y logs de clic...');
  const detailRes = await fetch(`${baseUrl}/api/links/${wiseData.data.id}`);
  const detailData = await detailRes.json();
  console.log('Clicks count:', detailData.data.clicks_count);
  console.log('Clicks log:', detailData.data.recent_clicks);
  if (detailData.data.clicks_count !== 1 || detailData.data.recent_clicks.length !== 1) {
    throw new Error('El registro de clics no se actualizó correctamente');
  }

  // 5. Test: Listar enlaces filtrados por workspace
  console.log('\n5. Test: Listar enlaces de Wise...');
  const listWise = await fetch(`${baseUrl}/api/links?workspace=wise`);
  const listWiseData = await listWise.json();
  console.log('Enlaces Wise encontrados:', listWiseData.count);

  console.log('\n5.2 Test: Listar enlaces de Onclusive...');
  const listOnclusive = await fetch(`${baseUrl}/api/links?workspace=onclusive`);
  const listOnclusiveData = await listOnclusive.json();
  console.log('Enlaces Onclusive encontrados:', listOnclusiveData.count);

  // 6. Test: Métricas globales
  console.log('\n6. Test: Métricas globales (/api/stats/overview)...');
  const statsRes = await fetch(`${baseUrl}/api/stats/overview`);
  const statsData = await statsRes.json();
  console.log('Estadísticas globales:', JSON.stringify(statsData.stats, null, 2));

  // 7. Test: Validar colisión de alias duplicado
  console.log(`\n7. Test: Validar alias duplicado (${testSlug}, debe retornar 409 Conflict)...`);
  const duplicateRes = await fetch(`${baseUrl}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      original_url: 'https://otro-sitio.com',
      short_code: testSlug,
      workspace: 'wise'
    })
  });
  console.log('Status duplicado:', duplicateRes.status);
  const dupData = await duplicateRes.json();
  console.log('Error mensaje:', dupData.error);
  if (duplicateRes.status !== 409) {
    throw new Error('No previno el alias duplicado');
  }

  // 8. Test: Eliminar enlace
  console.log('\n8. Test: Eliminar enlace Onclusive...');
  const delRes = await fetch(`${baseUrl}/api/links/${onclusiveData.data.id}`, {
    method: 'DELETE'
  });
  const delData = await delRes.json();
  console.log('Eliminar status:', delRes.status, delData);

  console.log('\n✅ TODAS LAS PRUEBAS DE LA API PASARON SATISFACTORIAMENTE.');
}

runTests().catch(err => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
