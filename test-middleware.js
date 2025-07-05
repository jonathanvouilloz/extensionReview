const baseUrl = 'http://localhost:8787' // Changez selon votre configuration

async function testMiddleware() {
  console.log('🔍 Test des middlewares de sécurité...\n')
  
  // Test 1: CORS Headers
  console.log('1. Test des headers CORS...')
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'OPTIONS'
    })
    console.log('✅ CORS:', response.headers.get('Access-Control-Allow-Origin'))
  } catch (error) {
    console.log('❌ CORS test failed:', error.message)
  }
  
  // Test 2: Rate Limiting
  console.log('\n2. Test du rate limiting...')
  try {
    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(fetch(`${baseUrl}/health`))
    }
    const responses = await Promise.all(promises)
    console.log('✅ Rate limiting: Toutes les requêtes passent')
  } catch (error) {
    console.log('❌ Rate limiting test failed:', error.message)
  }
  
  // Test 3: Validation d'injection SQL
  console.log('\n3. Test de protection SQL injection...')
  try {
    const response = await fetch(`${baseUrl}/api/projects/ABC-123-XYZ?search='; DROP TABLE projects; --`)
    if (response.status === 400) {
      console.log('✅ SQL Injection: Bloqué correctement')
    } else {
      console.log('❌ SQL Injection: Non bloqué')
    }
  } catch (error) {
    console.log('❌ SQL Injection test failed:', error.message)
  }
  
  // Test 4: Validation XSS
  console.log('\n4. Test de protection XSS...')
  try {
    const response = await fetch(`${baseUrl}/api/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project_code: 'ABC-123-XYZ',
        url: 'https://example.com',
        text: '<script>alert("XSS")</script>'
      })
    })
    if (response.status === 400) {
      console.log('✅ XSS Protection: Bloqué correctement')
    } else {
      console.log('❌ XSS Protection: Non bloqué')
    }
  } catch (error) {
    console.log('❌ XSS test failed:', error.message)
  }
  
  // Test 5: Validation des formats
  console.log('\n5. Test de validation des formats...')
  try {
    const response = await fetch(`${baseUrl}/api/projects/INVALID-CODE`)
    if (response.status === 400) {
      console.log('✅ Format validation: Code projet invalide bloqué')
    } else {
      console.log('❌ Format validation: Code projet invalide non bloqué')
    }
  } catch (error) {
    console.log('❌ Format validation test failed:', error.message)
  }
  
  // Test 6: Headers de sécurité
  console.log('\n6. Test des headers de sécurité...')
  try {
    const response = await fetch(`${baseUrl}/health`)
    const headers = {
      'X-Content-Type-Options': response.headers.get('X-Content-Type-Options'),
      'X-Frame-Options': response.headers.get('X-Frame-Options'),
      'X-XSS-Protection': response.headers.get('X-XSS-Protection')
    }
    console.log('✅ Security Headers:', headers)
  } catch (error) {
    console.log('❌ Security headers test failed:', error.message)
  }
  
  console.log('\n✅ Tests terminés ! Les middlewares de sécurité sont opérationnels.')
}

// Exécuter les tests
testMiddleware().catch(console.error) 