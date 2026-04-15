# 🚀 Deploy com Coolify

Guia completo para publicar a aplicação na sua VPS Contabo usando Coolify.

## 📋 Pré-requisitos

- ✅ VPS na Contabo com Coolify instalado
- ✅ Domínio: `revoluto.com.br`
- ✅ Subdomínio desejado: `appfinancas.revoluto.com.br`
- ✅ Acesso SSH à VPS
- ✅ Repositório Git (GitHub, GitLab, Gitea, etc.)

---

## 🔧 Passo 1: Configurar o Repositório Git

### 1.1 Criar repositório (se ainda não tiver)

```bash
cd /Users/paulocesarca/Documents/project_devs/app-azevedo-mineiro
git init
git add .
git commit -m "Initial commit - App financeiro multi-user"
```

### 1.2 Fazer push para GitHub/GitLab

```bash
git remote add origin https://github.com/seu-usuario/app-financeiro.git
git branch -M main
git push -u origin main
```

**Nota:** Substitua `seu-usuario` e a URL com seus dados reais.

---

## 🌐 Passo 2: Configurar DNS

Aponte o subdomínio para sua VPS:

1. Acesse o painel de DNS do seu registrador de domínio
2. Crie um registro **A**:
   - **Nome:** `appfinancas`
   - **Tipo:** A
   - **Valor:** `[IP_DA_SUA_VPS]`
   - **TTL:** 3600 (ou padrão)

**Para obter o IP da VPS:**
```bash
curl ifconfig.me
# ou
hostname -I
```

Aguarde 5-30 minutos para propagação do DNS.

---

## 🐳 Passo 3: Deploy via Coolify

### 3.1 Acessar Coolify

1. Abra `https://[IP_DA_VPS]:3000` no navegador
2. Faça login com suas credenciais do Coolify

### 3.2 Adicionar novo Deploy (Docker Compose)

1. **Sidebar esquerdo** → **Projects** → Criar novo projeto
   - Nome: `App Financeiro`
   - Description: `Gestão financeira familiar`

2. **Dentro do projeto** → **New Resource** → **Docker Compose**

3. **Configurar o repositório:**
   - **Git Repository:** Cole a URL do seu repo
     ```
     https://github.com/seu-usuario/app-financeiro.git
     ```
   - **Branch:** `main`
   - **Docker Compose File Path:** `/docker-compose.yml`
   - **Build Pack:** None (Coolify detectará automaticamente)

4. **Environment Variables:**
   Adicione as variáveis necessárias:
   ```
   JWT_SECRET=sua-chave-secreta-super-segura-aqui-com-32-caracteres
   ```
   
   💡 **Gerar um JWT_SECRET seguro:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. **Domains:**
   - Adicione: `appfinancas.revoluto.com.br`
   - Ative **Auto HTTPS**

6. **Volume Persistence:**
   - O `db_data` já está configurado no `docker-compose.yml`
   - Ele persiste automaticamente

### 3.3 Deploy

1. Clique em **Deploy**
2. Aguarde a build (5-10 minutos):
   - ✅ Build da imagem backend
   - ✅ Build da imagem frontend
   - ✅ Push para repositório local
   - ✅ Containers iniciando

3. Verifique os logs em **Logs** aba

---

## ✅ Passo 4: Verificar o Deploy

### 4.1 Testar a aplicação

```bash
# Acessar a aplicação
curl https://appfinancas.revoluto.com.br

# Ou no navegador
https://appfinancas.revoluto.com.br
```

### 4.2 Verificar saúde dos containers

```bash
# Via SSH na VPS
docker ps
docker logs appfinancas-backend
docker logs appfinancas-frontend
```

### 4.3 Testar API

```bash
curl https://appfinancas.revoluto.com.br/api/auth/me
# Deve retornar 401 (não autenticado) ou erro, é esperado
```

---

## 🔐 Passo 5: Configuração de Segurança

### 5.1 Mudar JWT_SECRET

**Nunca use o padrão em produção!**

1. Gerar novo JWT_SECRET:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. No Coolify:
   - **Settings** do resource → **Environment Variables**
   - Alterar `JWT_SECRET` com o novo valor
   - Fazer re-deploy

### 5.2 Backup do banco de dados

O SQLite fica em `/app/data/finance.db` dentro do container.

Para fazer backup:
```bash
# Via SSH na VPS
docker exec appfinancas-backend cp /app/data/finance.db /app/data/finance.db.backup
docker cp appfinancas-backend:/app/data/finance.db ~/backups/finance-$(date +%Y%m%d).db
```

---

## 🔄 Passo 6: Atualizações Futuras

### Ao fazer mudanças no código:

1. **Commit e push:**
   ```bash
   git add .
   git commit -m "Descrição da mudança"
   git push origin main
   ```

2. **No Coolify:**
   - Vá ao resource
   - Clique **Redeploy** (puxa o novo código e reconstrói)
   - Aguarde a build

---

## 🐛 Troubleshooting

### Erro: "Connection refused" ao acessar a aplicação

**Solução:**
1. Verifique se DNS resolveu:
   ```bash
   nslookup appfinancas.revoluto.com.br
   ```
2. Aguarde propagação de DNS (até 30 min)
3. Limpe cache do navegador (Ctrl+Shift+Delete)

### Erro: "502 Bad Gateway"

**Solução:**
1. Backend pode estar iniciando
2. Verifique logs em Coolify:
   ```bash
   docker logs appfinancas-backend
   docker logs appfinancas-frontend
   ```
3. Se o problema persistir, faça re-deploy

### Erro: "Cannot find module" no backend

**Solução:**
1. Certifique-se que `package*.json` está no root do projeto
2. Re-deploy forçando rebuild:
   - Coolify → **Force Rebuild** → **Redeploy**

### API retorna 404 em produção

**Solução:**
- Frontend precisa chamar `/api` em vez de `http://localhost:3001`
- Isso já está configurado no `nginx.conf`
- Limpe cache do navegador

---

## 📊 Monitoramento

### Ver status dos containers

No Coolify:
- **Containers** aba: vê CPU, memória, uptime
- **Logs** aba: output em tempo real

---

## 🎯 Resumo Quick Start

```bash
# 1. Push código
git push origin main

# 2. Coolify → New Resource → Docker Compose
# 3. Colar repo URL: https://github.com/seu-usuario/app-financeiro.git
# 4. Adicionar environment: JWT_SECRET=...
# 5. Domínio: appfinancas.revoluto.com.br
# 6. Deploy
# 7. Acessar: https://appfinancas.revoluto.com.br
```

---

## 📞 Suporte

Se tiver problemas:

1. Verifique os **logs do Coolify**
2. Teste a **conexão SSH à VPS**
3. Confirme que o **DNS resolveu**
4. Verifique **firewall/portas**:
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

---

**Última atualização:** 2026-04-15
**Versão:** 1.0
