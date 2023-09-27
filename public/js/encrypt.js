window.encryptPassword = function(password) {
    console.log('Let"s encrypt');
    const bcrypt = dcodeIO.bcrypt;
    const encryptedPasswordString = bcrypt.hashSync(password, 10);
    console.log('encryptedPasswordString=',encryptedPasswordString);
    return encryptedPasswordString;
}