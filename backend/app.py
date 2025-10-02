from fastapi import FastAPI, HTTPException
from pydantic import BaseModel 
from pymongo import MongoClient
from fastapi.middleware.cors import CORSMiddleware
import logging
from bson.objectid import ObjectId

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
    # client = MongoClient("mongodb+srv://gregory_db_user:PjkXT334F5LYsiin@labprojfinal.uxbpfeq.mongodb.net/?retryWrites=true&w=majority&appName=tcc")
    client = MongoClient("mongodb+srv://gregorydiascontato_db_user:VJpV9Ul0uhzb4KPm@tcc.hiuj0r4.mongodb.net/?retryWrites=true&w=majority&appName=tcc")
    db = client["projetofinal"]
    traducoes_collection = db["traducoes"]
    logging.info("Conexão com MongoDB realizada com sucesso!")
except Exception as e:
    logging.error(f"Erro ao conectar no MongoDB: {e}")

class TraducaoRequest(BaseModel):
    original: str
    traduzido: str

class TraducaoUpdateRequest(BaseModel):
    original: str | None = None
    traduzido: str | None = None

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

@app.get("/traduzidas/{id_usuario}")
def buscar_traducoes_por_usuario(id_usuario: str):
    try:
        docs = list(traducoes_collection.find({"id_usuario": id_usuario}))
        traducoes = [{"id": str(doc["_id"]), "original": doc.get("original"), "traduzido": doc.get("traduzido")} for doc in docs]
        return traducoes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar traduções: {e}")

@app.put("/traducao/{id_traducao}")
def atualizar_traducao(id_traducao: str, request: TraducaoUpdateRequest):
    try:
        try:
            oid = ObjectId(id_traducao)
        except Exception:
            raise HTTPException(status_code=400, detail="ID inválido.")

        campos = {}
        if request.original is not None:
            campos["original"] = request.original
        if request.traduzido is not None:
            campos["traduzido"] = request.traduzido

        if not campos:
            raise HTTPException(status_code=400, detail="Nada para atualizar. Envie 'original' e/ou 'traduzido'.")

        result = traducoes_collection.update_one(
            {"_id": oid, "id_usuario": "usuario123"},
            {"$set": campos}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Tradução não encontrada.")

        return {"message": "Tradução atualizada com sucesso!", "id": id_traducao, "atualizado": campos}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar tradução: {e}")

@app.delete("/traducao/{id_traducao}")
def deletar_traducao(id_traducao: str):
    try:
        try:
            oid = ObjectId(id_traducao)
        except Exception:
            raise HTTPException(status_code=400, detail="ID inválido.")

        result = traducoes_collection.delete_one({"_id": oid, "id_usuario": "usuario123"})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Tradução não encontrada.")

        return {"message": "Tradução excluída com sucesso!", "id": id_traducao}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao excluir tradução: {e}")