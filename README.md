Application Overview
Structure: Single Page Application with 5 collapsible sections
Technologies:

OAuth 2.0 (Authorization Code Flow + PKCE)

**PKCE Flow (Recommended for SPAs)**
Proof Key for Code Exchange - For public clients without client_secret

🔄 Flow Steps & Code Mapping
Step	Action	Code Reference
1. Generate code_verifier	--> generateCodeVerifier()
2. Create code_challenge	--> sha256() + base64urlencode()
3. Store verifier temporarily -->	sessionStorage.setItem('verifier')
4. Redirect to auth server -->	loginWithPKCE()
5. Receive authorization code	URL parameter parsing in --> checkAuth()
6. Exchange code + verifier for token	PKCE block in --> checkAuth()

**Secret-Based Flow**
Traditional Authorization Code Flow - Uses client_secret

🔄 Flow Steps & Code Mapping
Step	Action	Code Reference
1.	Redirect to auth server	Secret-based block in checkAuth()
2.	Receive authorization code	URL parameter parsing
3.	Exchange code + secret for token	client_secret in POST body
