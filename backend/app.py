from fastapi import FastAPI, HTTPException
from pydantic import BaseModel 
from pymongo import MongoClient
from fastapi.middleware.cors import CORSMiddleware
import logging

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # permite que qualquer dominio acesse a api
    allow_credentials=True, # permite enviar cookies/autenticacao se necessario
    allow_methods=["*"], # permite todos os metodos
    allow_headers=["*"], # permite todos os headers, os tipos de cabeçalhos que podem ser enviados
)

# Conexão com MongoDB
try:
    # client = MongoClient("mongodb://localhost:27017/")
    client = MongoClient("mongodb+srv://gregory_db_user:PjkXT334F5LYsiin@labprojfinal.uxbpfeq.mongodb.net/?retryWrites=true&w=majority&appName=tcc")
    db = client["projetofinal"]
    traducoes_collection = db["traducoes"]
    logging.info("Conexão com MongoDB realizada com sucesso!")
except Exception as e:
    logging.error(f"Erro ao conectar no MongoDB: {e}")

class TraducaoRequest(BaseModel):
    original: str
    traduzido: str

@app.post("/salvar")
def salvar_traducao(request: TraducaoRequest):
    try:
        nova_traducao = {
            "id_usuario": "usuario123",  # fixo
            "original": request.original,
            "traduzido": request.traduzido
        }
        result = traducoes_collection.insert_one(nova_traducao)
        return {"message": "Tradução salva com sucesso!", "id": str(result.inserted_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar tradução: {e}")

@app.get("/traduzidas")
def buscar_traducoes():
    try:
        traducoes = list(traducoes_collection.find({"id_usuario": "usuario123"}, {"_id": 0}))
        return traducoes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar traduções: {e}")