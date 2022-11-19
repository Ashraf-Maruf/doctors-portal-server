const express = require('express')
require('dotenv').config();
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const { query } = require('express');
const port = process.env.PORT || 5000;
const app = express()


// middleware
app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@lawyerservices.xcbpfac.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next){
    console.log('token inside VerifyJWT', req.headers.authorization);
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send('unauthorized access');
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
        next();
    })
}


async function run() {
    try {
        const appointmentOptionCollection = client.db('doctorsPortal').collection('appointmentOption')
        const bookingCollection = client.db('doctorsPortal').collection('bookings')
        const usersCollection = client.db('doctorsPortal').collection('users')


        app.get('/appointmentOption', async (req, res) => {
            const date = req.query.date;
            console.log(date)
            const query = {}
            const options = await appointmentOptionCollection.find(query).toArray()
            const bookingQuery = {appointmentDate: date}
            const alreadyBooked = await bookingCollection.find(bookingQuery).toArray()
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
                const bookedSlots = optionBooked.map(book => book.slot)
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
               option.slots = remainingSlots;
            })
            res.send(options)
        })

        /**
         * API Naming Convention
         * app.get('/bookings')
         * app.ger('/bookings/:id')
         * app.post('/bookings')
         * app.patch('/bookings/:id')
         * app.delete('/bookings/:id')
         */

        app.get('/bookings', verifyJWT, async (req, res) =>{
            const email =  req.query.email; 
            const decodeEmail = req.decoded.email; 
            if(email !== decodeEmail){
                return res.status(403).send({message: 'forbidden access'});
            }          
            const query = {email: email};
            const bookings = await bookingCollection.find(query).toArray()            
            res.send(bookings)

        })


        app.post('/bookings', async (req, res) =>{
            const booking = req.body
            const query ={
                appointmentDate: booking.appointmentDate,
                email:booking.email,
                treatment: booking.treatment
            }
            const alreadyBooked = await bookingCollection.find(query).toArray();
            if(alreadyBooked.length){
                const message = `You already have a booking on ${booking.appointmentDate}`
                return res.send({acknowledged: false, message})
            }
            const result = await bookingCollection.insertOne(booking)
            res.send(result)
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = {email:email};
            const user = await usersCollection.findOne(query)
            if(user){
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn:'1h'})
                return res.send({accessToken: token});
            }
            res.status(403).send({accessToken:''})
        })

        app.get('/users', async (req, res) =>{
            const query = {}
            const users = await usersCollection.find(query).toArray();
            res.send(users)
        })

        app.get('/users/admin/:email', async (req, res) =>{  
            const email = req.params.email;          
            const query = {email}
            const user = await usersCollection.findOne(query);
            res.send({isAdmin: user?.role === 'admin'});
        })

        app.post('/users', async (req, res) =>{
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.put('/users/admin/:id', verifyJWT, async (req, res) => {

            const decodeEmail = req.decoded.email;
            const query = {email: decodeEmail};
            const user = await usersCollection.findOne(query);

            if(user?.role !== 'admin'){
                return res.status(403).send({message: 'forbidden access'})
            }


            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const options = {upsert: true};
            const updatedDoc = {
                $set:{
                    role:'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result);
        })



    } finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})