import asyncio
from sqlalchemy import text
from nisha.infrastructure.database.session import engine

async def clear_all_data():
    tables = [
        "audio_transcriptions",
        "video_events",
        "audio_events",
        "commands",
        "mesh_routes",
        "agent_history",
        "agents"
    ]
    
    async with engine.begin() as conn:
        print("Clearing all agent data...")
        for table in tables:
            try:
                # Use TRUNCATE with CASCADE to handle foreign keys
                await conn.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
                print(f"Truncated {table}")
            except Exception as e:
                print(f"Failed to truncate {table}: {e}")
        print("All data cleared successfully.")

if __name__ == "__main__":
    asyncio.run(clear_all_data())
