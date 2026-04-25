import asyncio
import asyncpg

async def fetch_first_user():
    db_url = "postgresql://garagodb_user:JXxX9mhid6nZGzrHjHQWmWjq97mrmpRl@dpg-d7gj5t9j2pic73fbut0g-a.oregon-postgres.render.com/garagodb"
    
    try:
        conn = await asyncpg.connect(db_url, ssl='require')
        
        row = await conn.fetchrow('SELECT email FROM "users" WHERE is_active = true LIMIT 1')
        
        if row:
            email = row['email']
            print(f"FOUND_EMAIL:{email}")
            
            hashed_pw = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjIQqiRQYm"
            await conn.execute('UPDATE "users" SET hashed_password = $1 WHERE email = $2', hashed_pw, email)
            print("PASSWORD_RESET:password123")
        else:
            print("NO_USERS_FOUND")
            
        await conn.close()
    except Exception as e:
        print(f"DB_ERROR:{e}")

if __name__ == "__main__":
    asyncio.run(fetch_first_user())
