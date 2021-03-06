var config = require('../../config/db')
var sql = require('mssql')


module.exports = function(application){

	application.use((req,res,next)=>{
		console.log(req.url);
		next();
	});
	
	application.get('/login', function(req, res){	
		res.render('autentication/login', {n: 'Login', err:''});			
	});

	application.get('/register', function(req, res){
		res.render('autentication/register', {n: 'Registrar-se', err:''});		
	});
	application.get('/logout', function(req, res){
		req.session.destroy();
		res.redirect('/login');		
	});

	application.post('/login', function(req, res){
		var user = req.body;
		console.log(user);
		sql.connect(config).then(() => {
			return sql.query`Select u.*, c.NomeEmp from Usuario as u, Cliente as c where Usuario = ${user.username} and Senha = ${user.pass} and c.id = u.Cliente_Id`
		}).then(result => {
			sql.close();						
			autenticateLogin(res, req, result.recordset)
		}).catch(err => {
			console.log(err);
			sql.close()
			renderAuthErr(res, 'login', 'Login', 'Falha ao acessar o banco de dados');	
		});

		
	});
	application.post('/register', function(req, res){ ;
		register(req.body, req, res);
	});
	application.get('/postlogin', (req, res)=>{
		if(req.session.auth) {
			res.render('postlogin')
		}else{
			res.redirect('/');
		}
	});
	autenticateLogin = (res, req, result) =>{
		console.log(result);
		if (result.length <= 0) {
			renderAuthErr(res, 'login', 'Login', 'Usuário/Senhas Incorretos');
		}else{
			req.session.user = result;
			console.log(req.session.user);
			
			res.redirect('/');
		}
	}
	register = async (user, req, res) => {
		queryKey(user, req, res);
	}

	queryKey = (user, req, res) => {
		sql.connect(config).then(() => {
			return sql.query`Select * from Chaves where chave = ${user.key}`
		}).then(result => {
			sql.close()			
			if (verifyKey(result.recordset)) {
				addClient(user, req, res)
			}else{
				renderAuthErr(res, 'register', 'Registre-se', 'Key de autenticação incorreta/inexistente ou inativa');
			}
			
		}).catch(err => {
			console.log(err);
			sql.close()
			renderAuthErr(res, 'register', 'Registre-se', 'Key de autenticação incorreta/inexistente ou inativa');	
		});
	} 

	verifyKey = (key)=>{
		console.log(key);		
		if (key == [] || key[0].Estado == 'inativo') {
			return false
		}else{
			return true
		}
	}

	addClient = (client, req, res)=>{
		sql.connect(config, err => {
			// ... error checks
		 
			const request = new sql.Request()
			request.stream = true // You can set streaming differently for each request
			request.query(`insert into Cliente(NomeEmp, CNPJ, Telefone, Endereco, Email, Chave) 
			values
				('${client.nome_emp}', '${client.cnpj}', '${client.telefone}', '${client.endereco}', '${client.email}', '${client.key}');
				update chaves set Estado = 'inativo' where chave = ${client.key}
				`) // or request.execute(procedure)
		 
			request.on('error', err => {
				console.log(err)
				renderAuthErr(res, 'register', 'Registre-se', 'Falha ao acessar o banco de dados');
			})
			request.on('done', result => {
				sql.close();
				getLastClient(client, res);			
			})
			
		})
	}
	getLastClient = (client, res) => {
		sql.connect(config).then(() => {
			return sql.query`Select Top 1 id from Cliente order by id desc`
		}).then(result => {
			sql.close();			
			registerUser(res, result.recordset[0].id, client.user, client.pass, client.email);			
		}).catch(err => {
			console.log(err);
			sql.close()
			renderAuthErr(res, 'register', 'Registre-se', 'Falha ao acessar o banco de dados');	
		});
	}
	registerUser = (res, idClient, user, pass, email) =>{
		sql.connect(config, err => {
			// ... error checks
		 
			const request = new sql.Request()
			request.stream = true // You can set streaming differently for each request
			request.query(`insert into Usuario(Usuario, Senha, Email, Cliente_Id, Nome, Nivel) 
			values
				('${user}', '${pass}', '${email}', ${idClient}, 'admin', 'admin')`) // or request.execute(procedure)
		 
			request.on('error', err => {
				res.send(err)
			})
			request.on('done', result => {
				sql.close();
				res.redirect('/login')			
			})
			
		})
	}
	renderAuthErr = (res, route, title, err) => {
		res.render(`autentication/${route}`, {n: title, err: err});
	}
}