const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')


const app = express();
require('dotenv').config()

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const verifyToken = (req, res, next)=>{
    const token = req.cookies?.token;
    if(!token){
        return res.status(401).send({message: 'Unauthorized access'})
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if(err){
            return res.status(401).send({message:'UnAuthorized Access'})
        }
        req.user = decoded;
        next()
    })
    
}





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.4lxln.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
   
    const jobsCollection = client.db("jobPortal").collection("jobs");
    const jobApplicationsCollection = client.db("jobPortal").collection("job-applications")
    
    app.get('/jobs', async(req, res)=>{
        const email = req.query.email;
        let query = {}
        if(email){
           query = {hr_email: email}
        }

        const cursor = jobsCollection.find(query)
        const result = await cursor.toArray()
        res.send(result)
    })

   app.get('/jobs/:id', async (req, res)=>{
    const id = req.params.id
    const query = { _id: new ObjectId(id)}
    const result = await jobsCollection.findOne(query)
    res.send(result)
   })

// Auth related API
app.post('/jwt', async(req, res)=>{
    const user = req.body;
    const token = jwt.sign({user}, process.env.JWT_SECRET, {expiresIn: '1h'})
    res
    .cookie('token', token, {
        httpOnly: true,
        secure:false
        }
    )
    .send({success: true})
});


app.post ('/logout', (req, res)=>{
    res.clearCookie('token', {
        httpOnly: true,
        secure: false
    })
    .send({success: true})
})




 //Jobs related apis
 app.post('/jobs', async(req, res)=>{
    const newJob = req.body;
    const result = await jobsCollection.insertOne(newJob)
    res.send(result)
 })




 //Delete job application
 app.delete(`/job-applications/:id`, async(req, res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const result = await jobApplicationsCollection.deleteOne(query)
    res.send(result)
 })



// get some jobs by email, this is for the employer to see the applications
app.get('/job-applications',verifyToken, async(req,res)=>{
    const email = req.query.email
    const query = {applicant_email: email}
  

    if(req.user.user.email !== req.query.email){
        return res.status(403).send({message: 'forbidden access'})
    }

    console.log(req.cookies)
    
    const result = await jobApplicationsCollection.find(query).toArray()

    //fokira system,
    for(const application of result){
        // console.log(application.job_id)
        const query1 = { _id: new ObjectId(application.job_id)}
        const job = await jobsCollection.findOne(query1)
        if(job){
            application.title = job.title;
            application.company = job.company;
            application.location = job.location;
            application.logo = job.company_logo;
            application.jobType = job.jobType;
            application.category= job.category;
        }
    }
    res.send(result)
})



app.patch('/job-applications/:id', async(req, res)=>{
    const id = req.params.id
    const data = req.body
    const filter = {_id: new ObjectId(id)}
    const updatedDoc = {
        $set:{
            status: data.status
        }
    }
    const result = await jobApplicationsCollection.updateOne(filter, updatedDoc)
    res.send(result)
})

app.get('/job-applications/jobs/:job_id', async(req, res)=>{
    const jobId = req.params.job_id;
    const query = {job_id: jobId};
    const result = await jobApplicationsCollection.find(query).toArray()
    res.send(result)
})

//job application apis
app.post('/job-applications', async(req, res)=>{
    const application = req.body
    const result = await jobApplicationsCollection.insertOne(application)
console.log(application)

    // Not the best way (use aggregate)
    const id = application.job_id;
    const query = {_id: new ObjectId(id)}
    const job = await jobsCollection.findOne(query)
    console.log(job)
    let newCount = 0
    if(job.applicationCount){
        newCount = job.applicationCount + 1
    }else{
        newCount = 1
    }

    // now updata the job info...
    const filter = {_id: new ObjectId(id)};
    const updatedDoc = {
        $set:{
            applicationCount: newCount
        }
    }
    const updateResult = await jobsCollection.updateOne(filter,updatedDoc)

    res.send(result)
})
    
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send("Job is falling from sky!")
})
app.listen(port,()=>{
    console.log(` Job is falling from sky! on port ${port}`)
})