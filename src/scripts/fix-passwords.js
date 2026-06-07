const bcrypt = require('bcryptjs');
const { pool } = require('../db/database');

async function fixPasswords() {
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('New hash for "password123":', hashedPassword);
    
    try {
        // Update all users with the new password hash
        await pool.query(
            `UPDATE users SET password_hash = $1 WHERE email IN ($2, $3, $4)`,
            [hashedPassword, 'bsse2480204@szabist.pk', 'bsse2480221@szabist.pk', 'admin@digitalwallet.com']
        );
        
        console.log('✅ Passwords updated successfully!');
        console.log('All users now have password: password123');
        
        // Verify the users
        const result = await pool.query('SELECT id, name, email, role FROM users');
        console.log('\n📋 Users in database:');
        result.rows.forEach(user => {
            console.log(`   - ${user.name} (${user.email}) - Role: ${user.role}`);
        });
        
    } catch (error) {
        console.error('❌ Error updating passwords:', error);
    } finally {
        await pool.end();
    }
}

fixPasswords();
