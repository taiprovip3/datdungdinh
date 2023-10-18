const passport = require('passport');
const express = require('express');
const https = require('https');
const socketIO = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const session = require('express-session');
require('./auth');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bycrypt = require('bcryptjs');
const SystemHealthMonitor = require('system-health-monitor');
var counter = 0;

// DB connection
const pool = new Pool({
  user: "taiproduaxe",
  host: "dpg-cjt898h5mpss738mq070-a.singapore-postgres.render.com",
  database: "datdundinh",
  password: "X3K8bx6Xa9Fx3CK9IbT1jiVJ5ls3h9tZ",
  port: 5432,
  ssl: true,
});

pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false
  );
`);

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Lỗi khi kết nối đến PostgreSQL:', err);
  } else {
    console.log('Kết nối thành công vào PostgreSQL, thời gian hiện tại:', res.rows[0].now);
  }
});

// App settings
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(session({
  secret: 'concavang',
  resave: false,
  saveUninitialized: true,
  cookie: {secure: false},
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser('concavang'));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Monitoring
const monitorConfig = {
  checkIntervalMsec: 1000,
  mem: {
    thresholdType: 'rate',
    highWatermark: 0.8,
  },
  cpu: {
    calculationAlgo: 'sma',
    thresholdType: 'rate',
    highWatermark: 0.8,
    periodPoints: 1,
  },
}
const monitor = new SystemHealthMonitor(monitorConfig);
monitor.start()
  .then(() => {
    console.log('monitor started!');
  }).catch(err => {
    console.error("err minitor=",err);
    process.exit(1);
  });

// Certificates
// const options = {
//   key: fs.readFileSync('./certificates/erukascholar.live/key.pem'),
//   cert: fs.readFileSync('./certificates/erukascholar.live/certificate.crt'),
// }
const file = fs.readFileSync('./resources/7D11107900BA646A084C33B2969E83CA.txt');
const filePath = path.join(__dirname, 'resources', '7D11107900BA646A084C33B2969E83CA.txt');
const options = {
  key: fs.readFileSync('./certificates/erukalearn.me/key.pem'),
  cert: fs.readFileSync('./certificates/erukalearn.me/erukalearn_me.crt'),
}; 
const server = https.createServer(options, app);
const io = socketIO(server);

function authenticateGoogleOAuth(req, res, next) {
  if(req.user) {
    return next();
  }
  return res.redirect('/auth');
}

function authenticateToken(req, res, next) {
  try {
    const token = req.signedCookies.token;
    const payload = jwt.verify(token, 'concavang');
    req.session.user = payload;
    return next();
  } catch (error) {
    console.error('authenticateToken error=', error.message);
    res.clearCookie("token");
    return res.redirect("/auth");
  }
}

function sendEmail(userId, toEmail) {
  try {
    const token = jwt.sign({ userId: userId, email: toEmail }, 'concavang', { expiresIn: '1d' });
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: 'taito1doraemon@gmail.com',
        pass: 'jmsqgsjqqopsfakz',
      },
    });
    const mailOptions = {
      from: 'taito1doraemon@gmail.com',
      to: toEmail,
      subject: 'Đạt Đủng Đỉnh',
      text: `Nhấp vào đường link sau để xác thực tài khoản: https://erukalearn.me/register/verify?token=${token}`,
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if(error) {
        console.error('Lỗi gửi email:', error);
        return error.message;
        // return res.status(500).send('Có lỗi xảy ra khi gửi email xác thực.');
      } else {
        console.log('Email đã được gửi:', info.response);
        // return res.send('Email xác thực đã được gửi.');
        return 'Email sent';
      }
    });
    return `Email was sent to ${toEmail}!`;
  } catch (error) {
    return error.message;
  }
}

// Routings
app.get('/test1', (req, res) => {
  return res.render('temp-access');
});
app.get('/test2', (req, res) => {
  const dataResponse = {
    statusEnum: 'MAIL_SENT',
    message: 'Tài khoản của bạn chưa được đăng ký. Chúng tôi đã gửi một đường link xác thực tới email của bạn. Vui lòng kiểm tra hộp thư',
    html: `
    <div class="border border-dark bg-light p-5 rounded-2 text-center">
      <img src="https://i.gifer.com/Fmcf.gif" alt="email-sent" width="256px" />
      <span class="d-block my-2">Tài khoản của bạn chưa được đăng ký. Chúng tôi đã gửi một đường link xác thực tới email. Vui lòng kiểm tra <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer">Gmail</a> (hoặc mục thư spam) và nhấp vào đường dẫn bên trong để tiếp tục <i class="fas fa-check-circle text-success"></i></span>
      <span class="d-block">Nếu bạn không nhận được?</span>
      <span class="text-decoration-underline text-primary crs" id="back"><a href="/auth"><i class="fas fa-long-arrow-alt-left"></i> quay lại</a></span>
    </div>
    `,
  };
  return res.render('temp-page', {dataResponse});
});
app.get('/', (req, res) => {
  return res.render('index');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.clearCookie("token");
  return res.send('Bye!');
});

app.get('/dashboard', authenticateToken, async (req, res) => {
  return res.send(`Hello world, ${req.session.user.email}!`);
});

app.post('/login/email', async (req, res) => {
  try {
    const { email, password, is_remember } = req.body;
    const queryUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    /**
     * case1: account ko tồn tại
     * case2: account tồn tại nhưng chưa verified,
     * cast3: account sai mật khẩu
     */
    if(queryUser.rowCount <= 0 || queryUser.rows[0].is_verified != true) {
      const dataResponse = {
        toastIcon: 'error',
        toastHeading: 'Error',
        statusEnum: 'NO_ACCOUNT_EXIST',
        message: `Tài khoản email ${email} này chưa được đăng ký`,
        html: ``,
      }
      return res.json(dataResponse);
    }
    const storedPassword = queryUser.rows[0].password;
    const equalPassword = bycrypt.compareSync(password, storedPassword);
    if(!equalPassword) {
      const dataResponse = {
        toastIcon: 'error',
        toastHeading: 'Error',
        statusEnum: 'WRONG_PASSWORD_LOGIN',
        message: 'Mật khẩu không đúng',
        html: ``,
      }
      return res.json(dataResponse);
    }
    const userId = queryUser.rows[0].id;
    const payload = {
      userId: userId,
      email: email,
    }
    const token = jwt.sign(payload, 'concavang', { expiresIn: '1d' }); 
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      maxAge: 86400,
      signed: true,
    });
    const dataResponse = {
      toastIcon: 'success',
      toastHeading: 'Login Success',
      statusEnum: 'LOGIN_SUCCESS',
      message: token,
      html: ``,
    }
    counter++;
    console.log('counter=',counter);
    return res.json(dataResponse);
  } catch (error) {
    
  }
});

app.get('/auth', (req, res) => {
  try {
    const token = req.signedCookies.token;
    if(token || req.session.user) {
      return res.redirect('/dashboard');
    } else {
      throw new Error('Not session login found!');
    }
  } catch (error) {
    res.clearCookie("token");
    return res.render('auth');
  }
});

app.get('/register/verify', async (req, res) => {
  const token = req.query.token;
  if(!token) {
    const dataResponse = {
      statusEnum: 'MISSING_TOKEN',
      message: 'Thiếu token xác thực',
      html: `<div class="border border-dark bg-light p-5 rounded-2 text-center">
      <i class="fas fa-shield-alt text-warning fa-2x"></i>
      <div class="my-3">
        <span class="d-block fw-bold">Thiếu token xác thực!</span>
        <span>Có vẽ bạn đang vô tình / cố tình gặp phải sự cố này. Chúng tôi không biết chính xác mục đích của bạn là gì nhưng đây là trang xác thực tài khoản và đã xảy ra lỗi đối với bạn. Vui lòng bấm nút quay lại để trở về trang chủ!</span>
      </div>
      <a href="/auth" class="btn btn-primary w-50 p-2 text-white" type="button"><i class="fas fa-long-arrow-alt-left"></i> Quay lại</a>
    </div>`,
    }
    return res.render('temp-page', { dataResponse })
  }
  try {
    const payload = jwt.verify(token, 'concavang');
    const userId = payload.userId;
    await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [userId]);
    console.log('tokenFromRegisterVerify=',token);
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      maxAge: 86400,
      signed: true,
    });
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Lỗi khi xác thực token:', error);
    return res.status(500).send('Có lỗi xảy ra khi xác thực tài khoản.');
  }
});

app.post('/register/email', async (req, res) => {// Register by email
  try {
    const { email, password } = req.body;
    // Kiểm tra xem email đã tồn tại trong CSDL hay chưa
    const checkMailQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if(checkMailQuery.rowCount > 0) {// Có tồn tại email register dưới csdl
      const isEmailVerified = checkMailQuery.rows[0].is_verified;
      if(isEmailVerified) {// Email đã xác thực -> báo lỗi tài khoản exist
        const dataResponse = {
          statusEnum: 'ACCOUNT_EXISTED',
          message: `Tài khoản email ${email} này đã được sử dụng. Nếu bạn quên mật khẩu hãy chọn đường dẫn Quên Mật Khẩu ở trang đăng ký!`,
          html: `<div class="border border-dark bg-light p-5 rounded-2 text-center">
          <i class="fas fa-times-circle text-danger fa-3x"></i>
          <span class="d-block my-2 fw-larger">Tài khoản email <b>${email}</b> này đã được sử dụng. Nếu bạn quên mật khẩu hãy chọn nút "Quên Mật Khẩu" ở trang đăng ký tài khoản nhé!</span>
          <a href="/auth" class="btn btn-primary w-50 p-3 text-white" type="button"><i class="fas fa-long-arrow-alt-left"></i> Quay lại</a>
        </div>`
        };
        return res.json(dataResponse);
      } else {// Email chưa xác thực
        const userId = checkMailQuery.rows[0].id;
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [password, userId]);
        const dataResponse = {
          statusEnum: 'RESENT_EMAIL',
          message: sendEmail(userId, email),
          html: `<div class="border border-dark bg-light p-5 rounded-2 text-center">
          <img src="https://i.gifer.com/Fmcf.gif" alt="email-sent" width="256px" />
          <span class="d-block my-2">Tài khoản của bạn chưa được đăng ký. Chúng tôi đã gửi một đường link xác thực tới email ${email}. Vui lòng kiểm tra <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer">Gmail</a> (hoặc mục thư spam) và nhấp vào đường dẫn bên trong để tiếp tục <i class="fas fa-check-circle text-success"></i></span>
          <span class="d-block">Nếu bạn không nhận được?</span>
          <span class="text-decoration-underline text-primary crs" id="back"><a href="/auth"><i class="fas fa-long-arrow-alt-left"></i> quay lại</a></span>
        </div>`
        };
        return res.json(dataResponse);
      }
    } else {// Không tồn tại email trong csdl
      const result = await pool.query('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id', [email, password]);
      const userId = result.rows[0].id;
      const dataResponse = {
        statusEnum: 'EMAIL_SENT',
        message: sendEmail(userId, email),
        html: `<div class="border border-dark bg-light p-5 rounded-2 text-center">
        <img src="https://i.gifer.com/Fmcf.gif" alt="email-sent" width="256px" />
        <span class="d-block my-2">Tài khoản của bạn chưa được đăng ký. Chúng tôi đã gửi một đường link xác thực tới email ${email}. Vui lòng kiểm tra <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer">Gmail</a> (hoặc mục thư spam) và nhấp vào đường dẫn bên trong để tiếp tục <i class="fas fa-check-circle text-success"></i></span>
        <span class="d-block">Nếu bạn không nhận được?</span>
        <span class="text-decoration-underline text-primary crs" id="back"><a href="/auth"><i class="fas fa-long-arrow-alt-left"></i> quay lại</a></span>
      </div>`
      };
      return res.json(dataResponse);
    }
  } catch (error) {
    console.error('Lỗi khi lưu dữ liệu vào cơ sở dữ liệu:', error);
    const dataResponse = {
      statusEnum: 'CATCH_ERROR',
      message: `Có lỗi xảy ra khi đăng ký tài khoản',
      html: '<div class="border border-dark bg-light p-5 rounded-2 text-center">
      <i class="fas fa-bug text-danger fa-3x"></i>
      <span class="d-block my-2 fw-larger">Đã xảy ra lỗi trong quá trình đăng ký tài khoản. Vui lòng liên hệ Administrator để được giải quyết!</span>
      <a href="${process.env.ADMINISTRATOR_CONTACT_URL}" target="_blank" class="d-block mb-3">Contact link <i class="fas fa-external-link-alt"></i></a>
      <a href="/auth" class="btn btn-primary w-50 p-3 text-white" type="button"><i class="fas fa-long-arrow-alt-left"></i> Quay lại</a>
    </div>`
    }
    return res.status(500).json(dataResponse);
  }
});

app.get('/oauth/google', passport.authenticate('google', {scope:['email', 'profile'],}));// Register by google oauth

app.get('/oauth/google/callback', passport.authenticate('google', { successRedirect: '/oauth/google/success', failureRedirect: '/oauth/google/failure' }));

app.get('/oauth/google/success', authenticateGoogleOAuth, async (req, res) => {
  try {
    const email = req.user.email;
    const password = "";
    const resultQuery = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if(resultQuery.rowCount > 0) {
      const userId = resultQuery.rows[0].id;
      const isEmailVerified = resultQuery.rows[0].is_verified;
      if(isEmailVerified) {// là login
        const payload = {
          userId: userId,
          email: email,
        }
        const token = jwt.sign(payload, 'concavang', { expiresIn: '1d' });
        res.cookie("token", token, {
          httpOnly: true,
          secure: true,
          maxAge: 86400,
          signed: true,
        });
        return res.redirect('/dashboard');
      } else {// là resent register
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [password, userId]);
        const dataResponse = {
          statusEnum: 'RESENT_EMAIL',
          message: sendEmail(userId, email),
          html: `<div class="border border-dark bg-light p-5 rounded-2 text-center">
          <img src="https://i.gifer.com/Fmcf.gif" alt="email-sent" width="256px" />
          <span class="d-block my-2">Tài khoản của bạn chưa được đăng ký. Chúng tôi đã gửi một đường link xác thực tới email ${email}. Vui lòng kiểm tra <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer">Gmail</a> (hoặc mục thư spam) và nhấp vào đường dẫn bên trong để tiếp tục <i class="fas fa-check-circle text-success"></i></span>
          <span class="d-block">Nếu bạn không nhận được?</span>
          <span class="text-decoration-underline text-primary crs" id="back"><a href="/auth"><i class="fas fa-long-arrow-alt-left"></i> quay lại</a></span>
        </div>`
        };
        return res.render('temp-page', { dataResponse });
      }
    } else {// là register lần đầu, có tồn tại email trong csdl nhưng chưa verified.
      const result = await pool.query('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id', [email, password]);
      const userId = result.rows[0].id;
      const dataResponse = {
        statusEnum: 'MAIL_SENT',
        message: sendEmail(userId, email),
        html: `<div class="border border-dark bg-light p-5 rounded-2 text-center">
          <img src="https://i.gifer.com/Fmcf.gif" alt="email-sent" width="256px" />
          <span class="d-block my-2">Tài khoản của bạn chưa được đăng ký. Chúng tôi đã gửi một đường link xác thực tới email ${email}. Vui lòng kiểm tra <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer">Gmail</a> (hoặc mục thư spam) và nhấp vào đường dẫn bên trong để tiếp tục <i class="fas fa-check-circle text-success"></i></span>
          <span class="d-block">Nếu bạn không nhận được?</span>
          <span class="text-decoration-underline text-primary crs" id="back"><a href="/auth"><i class="fas fa-long-arrow-alt-left"></i> quay lại</a></span>
        </div>`,
      };
      return res.render('temp-page', { dataResponse });
    }
  } catch (error) {
    console.error('Lỗi khi lưu dữ liệu vào cơ sở dữ liệu:', error);
    const dataResponse = {
      statusEnum: 'CATCH_ERROR',
      message: error.message,
      html: `<div class="border border-dark bg-light p-5 rounded-2 text-center">
      <i class="fas fa-bug text-danger fa-3x"></i>
      <span class="d-block my-2 fw-larger">${error.message}. Vui lòng liên hệ Administrator để được giải quyết!</span>
      <a href="${process.env.ADMINISTRATOR_CONTACT_URL}" target="_blank" class="d-block mb-3">Contact link <i class="fas fa-external-link-alt"></i></a>
      <a href="/auth" class="btn btn-primary w-50 p-3 text-white" type="button"><i class="fas fa-long-arrow-alt-left"></i> Quay lại</a>
    </div>`
    }
    return res.render('temp-page', { dataResponse });
  }
});

app.get('/oauth/google/failure', (req, res) => {
  return res.send('Somethings went wrong!');
});
app.get('/.well-known/pki-validation/7D11107900BA646A084C33B2969E83CA.txt', (req, res) => {
  return res.sendFile(filePath);
});

const schedule = require('node-schedule');
const { error } = require('console');
const { send } = require('process');
var cronExpress = '50 10 21 * * *';
var j = schedule.scheduleJob(cronExpress, function(fireDate){
  console.log('running job!');
  console.log(fireDate);
  const message = 'Thông báo quan trọng!';
  io.emit('emitter', message);
});

// Khởi động server
const port = process.env.PORT;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});