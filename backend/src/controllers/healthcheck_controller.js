const healthcheck = (async(req,res)=>{
    res.status(200).json(
        { "status": "ok" }
    )
})
export {healthcheck}