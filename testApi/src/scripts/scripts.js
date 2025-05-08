
    const CLIENT_ID = 'TestRESTApi';
    const CLIENT_SECRET = '123456789'; //AuthorizationCode flow: client secret 
    const REDIRECT_URI = 'https://coe-win11-1/AnyGlass/Home.html';
    const AUTH_URL = 'https://coe-win11-1/fwxserverweb/security/connect/authorize';
    const TOKEN_URL = 'https://coe-win11-1/fwxserverweb/security/connect/token';
    const SCOPE = 'fwxserver offline_access';
    const API_URL = 'https://coe-win11-1/fwxapi/rest';

    let accessToken = localStorage.getItem("accessToken") || "";

    const getPostOut = document.getElementById('getPostOut');
    const liveDataOut = document.getElementById('liveDataOut');
    const loginStatus = document.getElementById('loginStatus');
    const formatType = localStorage.getItem('formatType');
    const writeOutput = document.getElementById('writeOutput');
    const readDataSet = document.getElementById('readDataSet');
    const getHHData = document.getElementById('getHHData');

    function logout(){
        localStorage.removeItem("accessToken");
        localStorage.removeItem("tokenExpiry");
        window.location.href = REDIRECT_URI;
    }

    //save authenticatoin type
    function saveAuthType(){
        const selected = document.querySelector('input[name="authType"]:checked').value;
        localStorage.setItem('authType', selected);
    }
    //save format type
    function saveForamtType(){
        const selected = document.querySelector('input[name="formatType"]:checked').value;
        localStorage.setItem('formatType',selected);
    }
   
    //Token time function
    function updateTokenTimer(){
        const expiry = parseInt(localStorage.getItem("tokenExpiry"),10);
        const now = Date.now();
        const progressBar = document.querySelector('.token-progress-bar');

        if(!expiry || expiry < now){
            document.getElementById("tokenTimer").textContent = "Token expired.";
            progressBar.style.width = '0%';
            return;
        }
        
        const remaining = expiry - now;
        const totalDuration = parseInt(localStorage.getItem("tokenDuration"), 10);

        if(totalDuration > 0){
            const percentage = (remaining/totalDuration) * 100;
            progressBar.style.width = `${Math.max(0, percentage)}%`;
        }

        const minutes = Math.floor(remaining/60000);
        const seconds = Math.floor((remaining%60000)/1000);

        document.getElementById("tokenTimer").textContent = `Token Valid for: ${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }

    //PKCE Code flow 
    function base64urlencode(str) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    async function sha256(plain){
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        return await crypto.subtle.digest('SHA-256', data);
    }

    function generateCodeVerifier(){
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
    }

    async function loginWithPKCE() {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = base64urlencode(await sha256(codeVerifier));
        sessionStorage.setItem('verifier',codeVerifier);
        
        const authURL = `${AUTH_URL}?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
        window.location.href = authURL;
    }


    //Authentication
    function checkAuth(){
        //const authType = document.querySelector('input[name="authType"]:checked')?.value || 'pkce';
        const authType = localStorage.getItem('authType') || 'pkce';
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if(accessToken){//if already have accesstoken
            loginStatus.textContent = "Logged in with valid token.";
            updateTokenTimer();
            return;
        }
        if(error){
            loginStatus.textContent = "Auth Error :"+ error;
            return; 
        }

        if(authType === 'secret'){
            if(code){
                loginStatus.textContent = "Exchaning code for token...";
                fetch(TOKEN_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
                })
                .then(res => res.json())
                .then(data => {
                    if(data.access_token){
                        localStorage.setItem("accessToken",data.access_token);
                        loginStatus.textContent = "Token received!";
                        const expiresIn = data.expires_in;
                        const expirationTime = Date.now() + expiresIn * 1000;

                        localStorage.setItem("tokenExpiry",expirationTime);
                        window.history.replaceState({},document.title,REDIRECT_URI);
                        updateTokenTimer();
                        accessToken = data.access_token;
                    }else{
                        loginStatus.textContent = "Token exchage failed:\n"+JSON.stringify(data,null,2);
                    }
                })
                .catch(err => loginStatus.textContent = "Token Error: "+ err);
            }else{
                const state = 'xyz' + Date.now();
                const url = `${AUTH_URL}?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}&state=${state}`;
                window.location.href = url;
            }
        }
        
        if(authType === 'pkce'){
            if(code){
                const codeVerifier = sessionStorage.getItem("verifier");
                fetch(TOKEN_URL, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: `grant_type=authorization_code&client_id=${CLIENT_ID}&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code_verifier=${codeVerifier}`
                })
                .then(res => res.json())
                .then(data =>{
                    if(data.access_token){
                        accessToken = data.access_token;
                        localStorage.setItem("accessToken",accessToken);
                        localStorage.setItem("tokenExpiry",Date.now() + (data.expires_in*1000));
                        loginStatus.textContent = "Token acquired successfully";
                        window.history.replaceState({},document.title,REDIRECT_URI);
                        updateTokenTimer();
                    }else{
                        loginStatus.textContent = "Token exchange failed: " + JSON.stringify(data);
                    }
                })
                .catch(err => loginStatus.textContent = "Token Error: "+ err);
            }else{
                loginWithPKCE();
            }
        }
    }

    //API Interaction 
    async function getData(){
    try{
        const response = await fetch('https://coe-win11-1/fwxapi/rest/data/?pointName=@sim64:Float.Random(1,-50.0,50.0,0).Value',{
            headers:{'Authorization':'Bearer ' + accessToken}
        });
        const data = await response.json();
        getPostOut.textContent = 'Reading real-time values (HTTP GET):\n'+JSON.stringify(data,null,2);
        updateCollapsibleHeight(getPostOut);
    }catch(err){
        getPostOut.textContent = 'GET Error:\n'+err;
        updateCollapsibleHeight(getPostOut);
    }
    }

    async function postData(){
    try{
        const response = await fetch('https://coe-win11-1/fwxapi/rest/data',{
            method: 'POST',
            headers:{
            'Content-Type':'application/json',
            'Authorization':'Bearer ' + accessToken
            },
            body: JSON.stringify({
            "PointName": ["ac:TestAPI/SimFloatStep","ac:TestAPI/SimLongRamp","ac:TestAPI/SimLongRandom"]
            })
        });
        const data = await response.json();
        getPostOut.textContent = 'Reading real-time values (HTTP POST):\n' + JSON.stringify(data,null,2);
        updateCollapsibleHeight(getPostOut);
    }catch(err){
        getPostOut.textContent = 'POST Error:\n'+err;
        updateCollapsibleHeight(getPostOut);
    }
    }

    async function writeData(){
        const pointName = document.getElementById('writePointName').value;
        const value = document.getElementById('writeValue').value;
        if(value === ''){
            writeOutput.textContent = 'Enter Point Name...';
        }
        if(value === ''){
            writeOutput.textContent = 'Entre value...';
            return;
        }
        try{
            const response = await fetch('https://coe-win11-1/fwxapi/rest/data/write',{
                method: 'POST',
                headers:{
                    'Content-Type':'application/json',
                    'Authorization':'Bearer ' + accessToken
                },
                body: JSON.stringify([{
                    "PointName": pointName,
                    "Value": parseFloat(value)
                }])
            });
            const result = await response.json();
            writeOutput.textContent = "Writing Real-Time Value HTTP POST:\n"+JSON.stringify(result,null,2);
            updateCollapsibleHeight(writeOutput);
        }catch(err){
            writeOutput.textContent = "Write Error: " + err;
            updateCollapsibleHeight(writeOutput);
        }
    }

    async function readDb(){
        try{
            const response = await fetch('https://coe-win11-1/fwxapi/rest/dataset?PointName=db:Northwind.Orders',{
                headers:{'Authorization':'Bearer ' + accessToken}
            });
            const result = await response.json();
            
            if(formatType === 'table'){
                //tabular 
                if(!Array.isArray(result) || result.length === 0){
                    readDataSet.innerHTML="<p>No Data returend </p>"
                    return;
                }
                //get att unique keys across the dataset 
                
                readDataSet.innerHTML = `<div class="table-container">Reading DataSets HTTPS GET Dynamic Table: \n\n</div>${generateTableHtml(result)}`;
            }else{ //JSON Format 
             readDataSet.textContent = "Reading DataSets HTTPS GET:\n"+ JSON.stringify(result,null,2);
            }
            updateCollapsibleHeight(readDataSet);
        }catch(err){
            readDataSet.textContent=`<p class="error-message">${err}</p>`;
            updateCollapsibleHeight(readDataSet);
        }
    }

    async function fetchLiveData(){
    try{
        const response = await fetch('https://coe-win11-1/fwxapi/rest/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json','Authorization':'Bearer ' + accessToken},
            body: JSON.stringify({
                "PointName": [
                    "ac:TestAPI/SimFloatStep",
                    "ac:TestAPI/SimLongRamp",
                    "ac:TestAPI/SimLongRandom",
                    "ac:TestAPI/SimStaticLong"
                ]
            })
        });
        const data = await response.json();
        if(formatType === 'table'){
            liveDataOut.innerHTML = `<div>Reading Live data:\n\n</div>${generateTableHtml(data)}`;
         }else{
        //Direct Json 
         liveDataOut.textContent = "Reading Live Data HTTPS POST: \n" + JSON.stringify(data,null,2);
        }
        updateCollapsibleHeight(liveDataOut);
    } catch (err) {
        liveDataOut.textContent = 'Live Fetch Error:\n' + err;
        updateCollapsibleHeight(liveDataOut);
    }
    }

    async function fetchHHData(){
        const hhPoint = document.getElementById('hhPointName').value;
        if(hhPoint === ''){
            getHHData.textContent = "Enter Point Name";
            return;
        }
        try{
            const startRaw = document.getElementById("startDateInput").value;
            const endRaw = document.getElementById("endDateInput").value;
            const startDate = formatDateTimeLocal(startRaw);
            const endDate = formatDateTimeLocal(endRaw);

            if(!startDate || !endRaw){ 
                getHHData.textContent = "Enter both Start and End date.";
                return;
            }

            const point = encodeURIComponent(hhPoint);
            const response = await fetch(`https://coe-win11-1/fwxapi/rest/history?pointName=${point}&StartDate=${startDate}&EndDate=${endDate}`,{
                headers:{'Authorization':'Bearer ' + accessToken}
            });
            const data = await response.json();
            if(formatType === 'table'){
                if(!Array.isArray(data) || data.length === 0){
                    getHHData.textContent = "<p>No data returned</p>"
                    return;
                }
                getHHData.innerHTML = `<div>Reading Raw Historical Data HTTPS GET: ${hhPoint} \n\n</div>${generateTableHtml(data)}`;
            }else{
                getHHData.textContent = 'Reading Hyper Historical values (HTTPS GET):\n' + JSON.stringify(data,null,2);
            }
            updateCollapsibleHeight(getHHData);
        }catch(err){
            getHHData.textContent = 'GET Error: \n'+err;
            updateCollapsibleHeight(getHHData);
        }
    }

    //utility functions
    function formatDateTimeLocal (inputValue){
        if(!inputValue) return null;

        const date = new Date(inputValue);
        const offsetMinutes = date.getTimezoneOffset();
        const offsetSign = offsetMinutes > 0 ? "-" : "+";
        const pad = n => String(Math.abs(n)).padStart(2,'0');
        const offsetHours = pad(Math.floor(Math.abs(offsetMinutes)/60));
        const offsetMins = pad(Math.abs(offsetMinutes)%60);
        const offsetStr = `${offsetSign}${offsetHours}${offsetMins}`;

        return date.toISOString().slice(0,19) + offsetStr;
    }

    function generateTableHtml(data){
        const allKeys = new Set();
                data.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
                const headers = Array.from(allKeys);
                //Build HTML Table 
                let tableHtml = `<table border="1" cellspacing="0" cellpadding="5"><thead><tr>`;
                headers.forEach(header => {
                    tableHtml += `<th>${header}</th>`
                });
                tableHtml += `</tr></thead><tbody>`;

                data.forEach(row => {
                    tableHtml += `<tr>`;
                        headers.forEach(header => {
                            const cell = row[header] != null && row[header] !== undefined ? row[header] : '';
                            tableHtml += `<td>${cell}</td>`;
                        });
                        tableHtml += `</tr>`;
                });

                tableHtml += `</tbody></table>`;
                return tableHtml;
    }

    function updateCollapsibleHeight(element){
        const contentDiv = element.closest('.content');
        if(contentDiv.style.maxHeight && contentDiv.style.maxHeight !== '0px'){
            contentDiv.style.maxHeight = `${contentDiv.scrollHeight}px`;
        }
    }

    //Global refresh system 
    let globalRefreshInterval = 5000;
    let globalIntervalId =null;
    const refreshableFunctions = new Set();
    function initializeGlobalRefresh(){
        clearInterval(globalIntervalId);
        globalIntervalId =setInterval(() => {
            refreshableFunctions.forEach(fn => fn());
        }, globalRefreshInterval);

        setInterval(updateTokenTimer, 1000);
    }

    function registerRefreshableFunction(fn){
        refreshableFunctions.add(fn);
        return () => refreshableFunctions.delete(fn);//returns unregister function
    }

    document.getElementById('globalRefreshRate').addEventListener('change',function(){
        globalIntervalId = parseInt(this.value);
        initializeGlobalRefresh();
    });

    initializeGlobalRefresh();

    const unregisterLiveData = registerRefreshableFunction(fetchLiveData);
    const unregisterTokenUpdate = registerRefreshableFunction(updateTokenTimer);

    checkAuth();

    //just 
    function setDefaultDate(){
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate()-1);
        const formatInput = d => d.toISOString().slice(0,16);
        document.getElementById('startDateInput').value = formatInput(yesterday);
        document.getElementById('endDateInput').value = formatInput(now);
    }

    window.onload = setDefaultDate;

    //Related to UI 
    document.querySelectorAll(".collapsible").forEach(btn =>{
        btn.addEventListener("click",function(){
            this.classList.toggle("active");
            const content = this.nextElementSibling;
            content.style.maxHeight = content.style.maxHeight
                ? null
                : content.scrollHeight + "px";
            
        });
    });

    //on page load read saved value and update UI
    window.addEventListener('DOMContentLoaded',()=>{
        // Handle saved authType
        const savedType = localStorage.getItem('authType') || 'pkce';
        document.querySelector(`input[name="authType"][value="${savedType}"]`).checked = true;
        //Handle saved format type 
        const savedFormatType = localStorage.getItem('formatType') || 'pkce';
        document.querySelector(`input[name="formatType"][value="${savedFormatType}"]`).checked = true;
    });
