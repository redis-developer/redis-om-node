import { createClient } from 'redis';

import { Client } from '$lib/client';
import { Schema } from '$lib/schema/schema';
import { Entity } from '$lib/entity/entity';
import { Repository } from '$lib/repository';
import { removeAll } from './helpers/redis-helper';

describe("Vector", () => {
  let redis: ReturnType<typeof createClient>
  let client: Client
  let repository: Repository<Product>
  let entityIDs: string[]

  // define the interface, just for TypeScript
  interface Product {
    name: string;
    price: number;
    image: Buffer;
  }

  // define the entity class and add any business logic to it
  class Product extends Entity {
  }

  beforeAll(async () => {
    // establish an existing connection to Redis
    redis = createClient();
    redis.on('error', (err) => console.log('Redis Client Error', err));
    await redis.connect();

    // get a client use an existing Redis connection
    client = await new Client().use(redis);

    await removeAll(client, 'Product:')

    entityIDs = []
  })

  afterAll(async () => {
    await removeAll(client, 'Product:')

    await repository.dropIndex();

    // close the client
    await client.close()
  })

  it("demo", async () => {
    let schema = new Schema<Product>(
      Product, {
      name: { type: 'text' },
      price: { type: 'number' },
      image: { type: 'binary', vector: { algorithm: 'FLAT', dim: 512, distance_metric: 'COSINE', initial_cap: 5, block_size: 5 }}
    }, {
      dataStructure: 'HASH',
    });

    repository = client.fetchRepository<Product>(schema);

    await repository.createIndex();

    async function loadProduct(product: { name: string, price: number, image: string }) {
      let entity = await repository.createEntity();
      entity.name = product.name
      entity.price = product.price
      entity.image = Buffer.from(product.image, 'hex')
      return await repository.save(entity);
    }

    for (const product of products) {
      const entityID = await loadProduct(product)
      entityIDs.push(entityID)
    }

    // TODO: figure out rawSearch / where query encoding is happening ...

    // execute a raw search for the first product image ...
    const results = await redis.sendCommand([
      'FT.SEARCH', 'Product:index', '*=>[KNN 2 @image $query_vector]', 'PARAMS', '2',
      'query_vector', Buffer.from(products[0].image, 'hex'),
      'RETURN', '3', '__image_score name price',
      'SORTBY', '__image_score',
      'DIALECT', '2'
    ])

    // ... and we should get the first 2 products back in order
    expect(results).toStrictEqual([ 2,
      'Product:' + entityIDs[0], [ '__image_score', '-1.19209289551e-07' ],
      'Product:' + entityIDs[1], [ '__image_score', '0.212629973888' ],
    ])
  });
});

// Vector values taken from RedisInsight example (hex format to make comparing bytes with CLI slightly easier)
const products = [{
  name: 'Mobile phone cover',
  price: 50,
  image: `55cb1d40f7d0853e18b63d3d120c913fd182893e323a703eac4efb3e8891213e520a03405d2a423d44fcc03e6bed1d3f48eaa43b0a5d863fd153bc3f4d8a023f000000004189713f41ef543ea1f74a3c434fc63ed24b5c3e92559c3db4066b3f6ff9c63e4920883c565b443efb7c063f000000001288fc3ee264d23f000000007303de3af93a1a3fc10fc73e00000000000000001f52403fc3c7fc3f03a7463f6a61813fe613d73c9132ce3f77ee093f794ac03fca66c73fc0b35d3f00000000cab1d63f4b08853fdb93f33d30b08d3ed9bc943cfdb7203c0803c53fe33f633f00000000a5a9963e524c7c3f2104253fe9db8e3e466a893db8c60a3f4032a33ffd9c583f00000000fb631f3f0e50383d7847223f7f5a5a3d9a5cea3ef0092540c341833ba534833c22a2333f28e6ba3e8a401b3f9b66a23b92336e3f2c8c9d3fcec1e43f744157404ef16a3f8a63393e4c422e3d00000000ffacd53eacf1803ec6de1f3f636aa03af052bd3e11c0bc3f1a24f33d437b043ea244a03e98a78b3dd86008407724a03e3f0a333dd676fb3d79ffd93d747c143f1f1ac83a874df33fe1f69b3f72cd9b409b945e3e3bd9043d6c12a13f186de03dc9ec293c1b83cf3d917a9d3d30b6513df375ec3d884c943d773f733db45ae13c6aee8e3eb7aa333fe8c64c3f6a97143f700d5e3cb63a483e2296393c0000000014703d3f94198f3e18c7153e7d2c4e3e323b413f54123f3d1026223de82f6f3d6a9d2e3fe2078d3f3796d33fadd6973e7b249a3c6f86413eb41e8f3e3d662d3f5123cd3ec1fd343f0498533fc48aff3dc8bf4f3ef64e3540dd13163eaa80143f5f70683ea7dee23faae9d13ec90d903fd62e173fc942db3c3203f23e68d03e3f6557793f6e37893f0330b23dea1f7f3e1f8e343e4ae1ca3eb21a303ffd6adf3e37c6003f0000000099f2213e922acd3e3736cd3e7d776b3f5ab7993d16f5453df6d5133bf4f0a53f6112343ef250d83dff01813f817b2840c5438f3e226e723e50b8da3cb6f5034026ca533c8754fb3e0000000041873a3f591f8e3f39f2323fdd13f43ef639f53e98f2e53f2bf24f3e3776af3f9ddba13e944cdb3e4c740b3fde93773e3c4af03d364fa93f3d52703dab40393f7601963e7441703ee654653fced4343fa787ac3f4ee4103f3db31a3ea803eb3e3983e93e000000003fc11a3e4e3db43f1df001402aca903cbf11503ec172333c720e2b3f49545c3d12299d3ebb57dc3f0e205c3e7de96f3f4584ce3f8196733cef6a583d4db3993d22567f3f253ade3ee27fa73fbb7a7e3fe5378c3e39ee133fccbd07401e6ec13fb65b0e3efdcb383f51a85940682aae3f64b1843d83a83b3fc0568b3e6c84223f5087863f3cc0323c671ae13c580a813fcaaed53da820f03d4d5b593df0e1be3f3b8bed3f21687d3f9ecfe23f0e15a83e9008a23f2abbf03db708c33e8df9384087c18f3f150f523e88aaae3e1588a83eef438d3ec74c1b3d1063a83e300c09404cecd03f0517cb3e843ba83e41e7f83dece4ee3ec359423eb3b9203fd982853e3fce723c146f813f365e9a3ef96f993fe8a1073e392b8e3f225d433d3c2dff3bde61a93faa56dc3e2cf810400545de3f1110ba3e0822143edeec7c3e65ab963eae98633f8308693cc5eab53d19e6bb3ec7a5cb3e9204953f117a5c3f886b6940d0fafa3e373f3d3f6a390d3ec5c7a53e00000000ce2f8c3ee5a7073f00000000872b783e4161cf3d32174f3c0000000054cd493c78c51b400fa2993d100bd03ce707d63fa1781f3f7c3ee53fe82053407cd9d13ed9a80840ac7a343eaa51113e2a51dd3f36c49c3cf4ed243f0f69093d1e915b3e28151b3e9a82a03c37b9ad3fb389713dc9722b40fa348e3fc337803fe789cb3dc8e6903f07308d3fffdee53df5e9243da795dc3ebdfb1b40955db63c3565133fc7803e3f0722003fdb87103f7994cd3f0668173c15e8cb3fa3b38e3d2aaa2d3e441bd43f099dd33ee53f2f3f1f94b93e0000000090ee613f598f484030ab283e843db83f0000000099e0be3f88d8793f3face13a41e1b83f5b8003406ece473f000000006b70893f5465cf3eb463623f3e849f3e70669e3b3682413f28554b3c5d368e3f7560243e7bdfaf3ec59bdf3ff82bef3dce4e423f0000000005b19f3ce434903eec712f3e40c8d13da9c3243e268ec23f000000002ede793e7ea20a3daefbfd3de6214f3ef9b1cb3fece9513ea77ac23ea9c4903e000000003fb7be3f6123b43e876b663ebdd6f53eef82303e6418a53f56746d3d77aa1a40da86a13fde72e83effd88b3d960bdd3d1d9d5d3e76da953f92c0ff3f8c6c813dc952e23ed130193fdd0ac03eac528f3abbcf393d87dc863ef3391a3f221d673fb800d73d2196973f00000000ef13a83e54a4173ef3fb2c3ffdadb43e00000000000000004cc0d33dc1539e3b5ba6c03fbbd9113daf0e413fcc62283d0ccb983d65da463e3fbd0b3f22c5d33e47f8773ea57e103ee1f03f3d2b12883b234c5c3e4889933f03a3e23da3f7993fc533663eb98ddd3f54a8b83ebcf5193a050fbf3f72fbba3ece4f313f516e863f510fca3e9abeaa3ffbe7fa3d3074843f0a758e3de8841d3ffb77b13e1fd14a3f8ce8ff3e2aa3c63b000000001610a93e0ab8ff3e9687b13e1c2b1c40637fdb3d91c6a83e16c98e3f6ce4213f628c383f4162fc3e7c44b03e8387803e40b5883c12622040229b0f3daf1c8f3fc044953ed1f0673e6197f33e3f09823f5809023eceea743fa310063ef20fa03cbeb4833cf394893fccc94e4065d7833e70a9913f28528e3d2e28a43e1053363f2136c43d1b34813daaae713f886add3ed587383f3260a93f2216503f000000004bac993e` }, {
    name: 'Gold phone cover',
    price: 78,
    image: `262044403437ba3bac28ae3f51461e3f62a8223eff4db63edd1880404835053f0afd464091b6163fcafbc43f4e0c7f3f1695053f2ce8e93e68cc293fd0b6be3f51953d3cc338264054a5c63d779e163ebb82383f1418993e9ab8f23f5421b63f8187f13faee4aa3fe3ac373f0c919e3ee5c9883ee5b7083ef0ef15404c5d1b3f7f88073ce7c1064063e05e3fdd4b603d88d3ca3ea772a23fd6068240dbc6b53d678fba3e56516a3c1bd7d03faef2213fa5b14940e2f9dd3fff44023fa1a4a23d58cf463ff902953e00000000e5f50c3f45439f3f000000001076b03f799a003fd4cefa3e7bbef33e5dbb1840c026f03f70a1113faa22ed3c703b563dbc67653f28d4703f3c67f43de1426e3da23a0c3e81ddb23ea8c5873ceee9be3e45e86b4041fc943eee20e13dcad90c40fd711e3fcaeec23e3822153dc97dbd3ffbb3b93dd428e83fde0a35401268ac3fb480c23d94e6b83da2cc4c3fe8dd8f3f6618c53f5b7c723f38f3d23dee29883f1274aa3ff400c93e8acf093e0e9dbd3fd01b133e5b7063408cf5423fec34323e8071453ec9525d3e229baf3fa667423ed877033f33adaa3f73bed43fbf47c43dda57a53fc12e7b3ed0faa93f7206ba3e00d8e33d8f819c3ee17bb83f58b68a3e5e4e4b3e257fb13d54d1a33ef8cc223e2cbdf93e3bab5240dd229d3fc9992f3d01dadd3ec722033a1abda93d9d96cc3e0e902d3f52a9f33e6317aa3e63b1223f5733143f352c1b3fa52f263f805d083dddf511403da10f40f6c3c83ed079463f4ebb253f1074603fef26bb3ecc305f3e99f85940eb01c83fb890983ee616433f775a693f05c5fd3e92362f3f62adcb3e47020a40bc04493cf5dd813f6341ee3d5df2a03e0000000040f4183eec8211403603843f7077e33fcd899e3e0553a03fccb159405b96493f5456903e0000000074be4f3f1646313e1344263fde99443e8007aa3eb4f69b3db728423e6fd9963f05809b3ee68fc43f66fdb43e0a6ec13f5f79f33fe8151d3f59e7293f76d6e93d852e22405247d73e78943c3ee6de3c3d55a13a3f6a90933f0ab03f3e5e34713ee644ce3dd9a4ed3f4653213db4a2233fe3f9014005f7a73fa2821b3ff262903fa872383d4c964d3ec2721d3faf01af3e827e933e9bdf533cf36dae3f23b89840c457793f032eca3fbc19b13ef0bb6c3da856003f000000003489d73bbbde4e3f74a48040d65ec23d25182b3f0a851e3e2304803f5b00ba3cb60b3f3fa75c0a40f079f53e8579493f1a5e2440f954a13c00000000ad71143da38f763f4d0c2d3f1f7fb53f80ffe33f8d79683bffa0153fafe7353f98e7124012c7b03fb70a553fdb4c45402fe9733e95214a3f33d3134018d28e3d5b57093f2f9ce63fea7edf3ee343d03fee141e406c6a863dfb5b033e5f50213d36c8564009d3533fca99353ec53d633f3f07183f0d6b424006e9803dbb9ac73ceab17e4055fc863f1e97d13dc460ec3e3617233f91a5b63e052af43c16b08c3e02a8143ffa9d8f401338803d04ad833e41da0e3bf8489b3f493a4c3ff2dfe13f877242404e05033d09e732402fb00d408162a13fa5c9453ec1e72e3ff0358c3d3f78d13fcc67b13f1aadc43e10c7814040f1c53fbbd2303f54c78a3d1dea963edf1e9a3f0990c23e88ac593ea3e8e43e7fdcc33fc812b83eac02b03fac67c53f8d4db440a560993f90308f3e4c20483d5ac1023eb963f73abf18463f14734e3f1c228f3c60319c3e410df23e8ce1c63f000000007c9bc43d840e444000000000bf42823e3dfb123f18a0083fca75ce3f5e6ad23f1b41403f631b224083a3f63e288b0d3f9f222d3f00000000965c0140d50eb13defd0903f1e36123d9fc6c63e0736e53faf4a1a3e5b2d3e40366e903df00ca63d04d3423da0240340492fd63f8051023f2273663fa79e4c3d67613e40b079033d72cac93e98910540e72f2e405933ba3b8d26563f2dd19e3fb090b53f3780a83db3c4d73eb7ed4f408ccd0740ac5f583f72e8ce3e369bc93dc05bc33eff658140a05f083feade1e3fd662fe3bfbd1ae3f3d3da43f2114653d0498f63f43a3bf400723433fb6768c3e5286623fab24853f8503e73f612fd43e04f8623f703a803e7cfa853fe9bc813f9146a93d5e74ac3ec356af3f5c7d903b6e3f8c3f000000009a9bfa3ef848ae3e194f4a3f122e3c3e5b39213facc8573f2210523f363c7b3e6e29783e21cb193da636d73f1a5c0a40bb1cdb3ed230973fe136e63eea12b13d7267493fff47833ff40fdb3dc7e5633f11e0683fd656ca3f04c18d3efc6fcf3ff0ec473f2faf3f3f10060b3e4109f33ee2835b3c34538d3fa86d5740b6504a3c1907b93fb22e3a3e79accb3e5fedbf3e7fa8903d7909303e4463ad3e7f09643f4edd7c3f7913393fe822163f7f3c034039b3373fa7949a3f07a7bd3f347b7d3e49c54b3e7824d23f8710b13d44bd14400ad4f63f88ae393e7388f33d07a64e3e3b400d3f46c1023f9634b03f9f32033c0800253f28fe833ea1e9c63ddb37453f3396533f08d3a43c2c72543f9be3ec3ffcd7a340f4c2cd3ffc4b3b3de32b133fa1c10e3fdae2f33e68cbd93f0c640540ec071940a8659b3d5bd1793fabcadd3ece562a4087010f3e5dcb913f15c27f3e38ddc63def334d3f7901843f1402743e1422ff3f184b6a4045c4703f3735eb3e4758503f093c033f45e5223d4952d73e9939253f146dc13d9fdf293f94891c404efa843f346e623f49b9a23f44536f3f34d46c3e5e28783f00000000f92b8d3e6a09403f1984163e83f7a73ef833ae3fc8f52e404e42993fc761753fac9fa93ec9c4a53e5517bc3f1447463bc48a263ed979613f4726f73e36b6bb3c0d9c3c3d6c5b953f6b222b3cf46afe3e`,
  }, {
    name: 'Patio Light',
    price: 120,
    image: `35d4113f32cdd43dc803043e85ff453da392643fa1b3da3e12cc113e5b99db3e7401653fe23d213f2be8953f54c82d4080137e3d23bc953e2392843e2317104000000000ab58703f44826040aed8a53fce99c33f9146a03e2284283f0a659c3edd996a3ef619ed3f5edac53e0923853ed974403f3b13fe3f5b81b03e01ac1c3e6e0de63ec81f723f2a408c3ec8398b3f98455d406e52333fb43cb03f0d6fb53de6910c3f9a54843f92ad0e3dc788bf3f720c673f778b643f2354cc3f265b0d3f3337983edea2413e537a1040486a6b3f2e567b3f1668db3fbc6152409df0cd3f314d9c3db2f9893fc5c3053f72cca23f4760d13e04faa83f95f9543eab420840548f0b3f0923143ec5a6b73ff85aa33eb201aa3e5617fc3eaa557f3f190d3c401b77fb3f8735443f03a3853d9503f33f2284be3e10c8253f3847503faae4753f33109e3f15c6df3ff6b4d63de8310d3f059932405487293fe86c923bda5a373e479c3d3eea87cf3fd8367b3ff6c76e3f660de43cd0d69a3eed00163f9d0e0e400a175c3f9fd8a53d00000000e8be963ef83a673fda9a933fe1651540b9a34e3efc29df3dcada8d40a85cac3e14150a3fc800af3e39019b3f4d048d3fa3dc6d3ff0730f40c95bbc3eeaf9ce3f20b1203d801fe03cd1fbc93facb54a3fcd915a3f4457a13eac1cae3f132b193fe58b5a3ec7a57f3fd6ce9f3e18988c3f485ae83ebd88f23e37832f3ff981c83ee23f2240db66a03f5ee4343efeac033fe7021a3fbe47a13e7265f13ef0d47a3f10541d3f5fbfca3db286dd3e7a30983e37e4f63e409dbc3f52c5233e4159323f61a2254068f6183fe179483e5a38453f459a2b4095c0a83f2574b93ecd5fb63d1c00a43ee86f513f7046f03ff34eb63fa35ea03e814cb03fbc4aa93fdc7d1b3f6528993f72d1673ff7b8c23fdb0e8e3e58643c3f3fff293f59ab413ed65a013fc4eab53f7b75373f6a2d453f2637283f03d8563f28bdad3c38a1b33e112c313f90e2243f0156ac3fccd5803f34faf73d7bd4803e3b04cc3c7779a73ee6e1c93feed9323fc1128b3d12151f400de8b53d6f09cc3d0d02373fc850f43e79c7a83dc573263fe35c5d3fc9bfd53bb26aa63f96d1a43ddb6d163e2c7eca3fe6ad363f9963283f0d09983f7423063dc522333f8a02573f851d2a3f39f9fe3d0169143d4cc59a3e16f0fa3fa1ad213fb937153f23ded03dc4e91f4078c7893f000000007d0f223fc54f933ee108c13e9bace83fcba50f409223d33e8b8e993fb336db3edd442e3f2555c13ed40cd93ea618043e901ce03f0573da3d5573293f388e023ef6c6a33c63db193edabb334036be2b3fe24c893f22bdac3fff31bd3e087bb63f647c9f3ef4e95d3f30dead3ff9747d3ec386263fcf2c0e3f74d9ec3e6cfb9b3f09c2b23e80e3a13f1988733e15b7ca3e689b1e3f4716933f840ae03ea1a52540ca2b533f227c883e63c1073e2558ca3e70e9a83e1668b13f133e213fbb9fbd3f0d08723ff9f1553f2f09f03eac3cbc3e8d1b9c3f07e81e40c85e213ddd4109403fbe863eda0f3a3e0462cc3f3768ad3e140ebe3e5b3ab73e94cd1340ea89be3fe647483d7c150540830b173fd4bf1b404379093fb73fee3d6c37133f1d80ca3e9a99653fc979aa3f8ffb123f2a52143fb971373f9807923ff6ea3e3f5a05e73eaca1793e21db3440f7c0e13e784c514059cf943e33d3553f0fb2893cc4c655405f0e3c3f40b11340dea3233f52301b3f76c8ef3f9d1aa93e9ac4553e807b793ea599573fd9872e3f805b6440e69cf23d95d1ba3e22150d3ff4c3fd3e165f3740213e803d4813bd3f2c33df3edb8b8e3ef6de2d40af40d33f7949813ef011613bdae2e13f454d8b3e684c763fd22a953fb699963e322f583fd98b1a3f2f39283f03f1733f4d51f33f3c253d407601643e14282a3f3fb42e3e4d03263f24d0963ff962154001f0823d38d7f73f03dba73ed430893d3f8e263fe5319e3ee5c5de3f99d39d3d4e42404061ae2240918eb43fd6b7443c0cd1a53f77a7c240d6ad223f990db73f7dde3f408764ce3f3facc23f837dbb3e3aa39a3ea1b9de3c10505a3f7b7e443f03187a3f7c23b63f3952523ff8121d4062f7733fa331fb3f6825ee3c32bf0a404441b63f4d9c4f3d12ec7d3faffa853fbc940a3dae88823ff98b1c3f1b3e5a3f5158353e619bbf3db74e433fb9a81e3e096e5c3d2c7c7a3f5be0843eac75d13de194d23fe368a53eecd1903f417ceb3faf9fa13fca7dfb3f1157313fbb18d43e5d33ea3fd001af3eeec31f3e5f12333fd54b3b40129f993fabe81b4087fba83e11319e3fecc5013feaa4b23e79010e40a26dc33d4120b63f4409bb3f43a5473f9d0f533fc501913f3218673fda34833d7637fc3d1a70dc3fd6a8d93cfc859d3d18c7503f0c07a63fa2cf1f3fa7d2ae3f557a4d3e199ee93f944b723e8a30483c25ae3f4034b98e3ebc10263f5a5914401da23740f77cc73ef21a703f9f297a3ff63f8e3f25e7044021846f3f65a61c3f4c953b409ff8593fe56bb33e703bd03d2a84283e9a22c540cef5733d66873e409c4d963f896b373f4ab0a43e15555a3ec4053a3e3737f23eca13893fe17cb53f38d4943ffcaad23e0d4bb43f7492113f2ea7233fe56fe23efccec23f2245733e18c5c63ff678373e1422983f01e3ce3fea06323fd9258b3e3932cb3eaa2bcb3f5fd6073e90af3b3f2892f83ebd710a3eb4561440c1133c4021d3234007da1c3f7f2d1f3f39150640bf045c3fe337543c5d0b863f0a3e903fa5faee3fa27f6c3c6a3e673fa8891f3d7cb28c3fe132b13fb9d5d43fdea3b43fd9d7383edd9cdd3e85530f3c5a43dd3e2b151c3f6533b63ef8929b3fc2311f3ea534803e656dc93f`,
  }, {
    name: '2-seater sofa',
    price: 400,
    image: `a8cd873f83e1553fe701173f3fabc83c9fd6613f51aa343fb43b883ff173083f207d943ffa6e19401618a93ff600ff3fc410763f493d443f5d579a3f1f0ddc3f4e0bfd3d25fc2b3faf43453ed146783fb498713e486bcb3f8a7c6d3fe7e9aa3f59482b3f1c34013f03fdee3e9e412940035a313fa5967d3e7983043f1f93393f5220233f85d9ea3dd6eacc3db48e243ff22f414038947d3e3c784f3f381ac33ff128a03e51cfcb3f81716b3f3fddd83f3d5b063f3bf4f63d50a1a13ebb111040f7a3573e12d1963e78a2ba3f8d05053fe474103d3f03d53ec12b2a402ae43b3fb0ea613facf0573f032c0f3f2e22b83fdefebd3f631b6e3fddfc823e2816d43d0a2dab3f5e7e653f3f67423fda7bcd3e7f3cde3e75530f3f094e233e225bb43ee528113fc4de713ec0ab4b3ea6baad3fd3c19f3f68f4473d49b8c83e416bdd3e2c94673e948f893f7b8c4d3ebf903e4003837e3ea7eb633facd6fd3cb4930d3f32d705406237a63fc97c2c3e7ae4143e98b9ba3e5b4e2b3ea6e24d3f67d8053fc4f049401a59623fb426be3f9fcbff3e5904153f707dc63f811bbe3e21c9833fda22163f9fa9f03ef39a3d3d8c381c3e2e3d2e3f41453c40ae0f1e3f0b721f3f8afe9c3ddb492d3e1b72403fa6baa13f2a517340482af53e10213e3fdbfb7d3f014e473e283b2840a4289a3fcc29e83f1b6af73f484b043e8420de3fd4b5853ec48a9d3f3784aa3ee14a833d1556eb3f6d5b933f5f64ce3f908ebd3e1452493fc161cc3e0ad08e3e122aae3d15676640394cbe3fefc3d43e905dde3faf9c433e8622a23c9d04683ea009104052cbda3f24689d3e5ee3b43fb2b92e40000000004c87e13fc3f3ae3ec4f2af3e4720083f25763d3fa767323f8a506f3ee395c43f5e9107402819973e8a49033f806a9b408e8c883fe15a943f372dcc3e22ff1b3fde3bae3f21c9a33f2259803e07d15c3d8576fa3f4d45d63e6fdc3c408d41b43f7824fa3daefb853e1a6dae3d167ce73eb7b20b4054a0963e7db4c73e74f1484004fe7b3f29e31f3f0433183fa9191b3f7280573f91746b3d3d17263f1bfea23d833b1b40099baf3e22d58a40086bff3d794df73e56d56e40bd531c4034cc8b3f5801a83ed4efed3f18ec3d3f770e043d7b82823e12e90d3fa55f033f967fb13f14cdac3ff35e6c3eb30cd43d5272373ede6bdd3e283cd63e7663573f907ad83e21c31f40de97803faaed643f1266a93f5451153f375b433e9a86ad3f4eb6d63fb8aa233f75a21040a776723f83d4f23d5aaed93ee6405d3e49b2063fb465853f7e5a143fccc19d39a2e8283f700b023f58e1d03ee1a01b3e7d62ac3bbf1adb3c25f87b3ff9d2283e30daa73f7953203f23b8533f3cc0833fa593403f339ab03c143e733f9d28f03e19e5d23ff342a23ee1e1683e437e4f3e8cb9bf3e16cc2a3f40d7033fccb4bb3e22258b3fec446a3e9d0ba63f7f94e73efb7fd83f651bb13e894c883f18b45c3f9f0bfe3e11b0ea3e52bd813fb88d9d3d0574043fdb05ef3e3931eb3ed82f4c3e7c688f3b28be013f988eb53e5db9e03ff755423feede163f8af6253f2adb21401259b63f3082963d2c7aa63fc7cfa83ef2cdf63d6c88133fb6541f3fbbf2c73ff0a2ec3fac75b13eb92810407cd5a53efda7003eb9604e3ee31fa93f32da173fdbd0383e402d2d3f964f2a3f68b0c13e45c81a3f94f4f03fc1ada33ea363bb3d4459e03ced6a023eb724f33e66a7093faa88cb3e64e2153f88feb83ff31d003e4708933fca7bf63fdf02c23eae2fb03ec7db133f4ec5153f50f5b13f5f25423f157f8c3ef9e8fd3e3991353fa1eb243ed4703140ef72af3e2a2ba43c386b143e8cd4843ea74b443e6895f13c7f2d0b40da5731405b33653f0358e93f799ba83e89b4ef3ed96ac23fe352463f6b9d823fb685aa3e3cd3e13cb2fd1540cde8fc3ebb39103f5e3ac03e0e6dcd3f78be373f7759bf3f33e6833f94309f3f50b4653f00000000f77f0840d619cb3ff0b3353fff7dec3e50e2483f95693b3f47b43d3ff7183b3f2846e03f6b0e4b40bdd7423f81eea53fb498853e10b02240b914253f3495443d10e8323f7433483ec569773fbf90f83fb450063e2c89373ecaa807406569fa3e1d708f3fade6143e2b07943fa77e9340108d2540a57d7a3e7854093f0729643f55e22d3f77020f3e946ed33ff9f025402118413ea7541f3f3792a63dbdf4933e7cd6363eca9e773faed1813f0715753e016df83de1730b3f7084113e66893c3fff723e40571882405306903f7b988f3fde962a3fb7a4a33ee17ce23fe1a02e3f8cf18c3fa3d9ea3f3d7ccb3facb2873f8d0e793fc7e02c3f1f4de63f9c2b1b3f30345c3f8e42823d49aab43d9b56e63f61add23f9072b93d7013dd3d47994a3fdd49b33ef83ea03ec813c23f2ab0233e3707e93f142e4e3efbf68640ef4bb23f053fd23f41829c3eb8404a3f5d41833e43d6a73e6e74063ba86f813d3fe3d43d1eb2af3f8841c23f1fa06f3e3f11e04022512b3f34ccb13e9ee8b23d7994c03fbcf8ba3f925fea3fd43ca53f3c66ca3e0e2bad3ca22fee3f70ba733f4ad3713e19ff6f3d4ca77a3ce2b3623fd18ef13e7718d93ee0be9e3f78211f3fac1c1640147741401f697c3ef5ff193f4c20283f01ea9d3f74903c40d9decf3f67420a3e4a1e7f3f4402aa3ee3f8413d9e3ec73f5a22d83f55700a3f48cabb3e99feff3e580d813f5581eb3f59f5803fca4cad3fd6ba1b3f051fdb3e2284a53f4a9f174077eed03e3205163f0bb4243f70d1c43fc7e72b3f66590e40d5c2873f22f1283f8d6e713fc359c93e58c0943f8a66b13db2bfce3e5d28303dc8f7543f3fb0c73c2ddd8c3f94db23405042443f6241a33f37407d3d`,
  }, {
    name: 'Comfy Chair',
    price: 200,
    image: `5101003f8b25923f1db69e3f1465113fdec3993b1000813f321fb33cc1d53f3ff9e68e3f2ec10840c869023f4082b03fe1711b3fd0fcff3debc3753e7086be3f1f2f8d3ec3acbf3f5059433fc8e2e43eae18093e6a935c3fafd41f3f3b48fa3d2e2a8a3f00000000688ef93e88a4083fe8439b3e33428a3f2b2ce13eb09d263f8c44113eb0fed83e907fd43eb90bca3d38c21c3fe1b4c23e87426e409de2a23da3030b3f0f0e8f3fb919283e414c883f98c7ca3e4cbcdf3fe767a03e4148683d433802400059173e6cb4c03f362f1240db64b53e9560613fa155c03fd5a7bd3f6a7db83e167a843f9bb5433ebfdcd33f3c72383f8dff673e785d9a3e6bf5223ef08e8e3fc4fc153fba7a8d3f4cf9bd3e32ab593e3b8f1e3e03e3813fb896a73f3f7e473f157b463e59306a3fe8ff973cc794b33f3fa74c3e14af573e1f9a85402631143e83fb8b3f88a8b73af8f9013f4df51540a799eb3e45fa1a3ef6d9223f67ab8b3f3faa6a3e951fbe3fbf33903fea9a853e3d10123e66435e3e5599c43f44b90a404869bb3e5f908f3e511bbf3ed111713dc77bc03d17ac0e3fd63b8f3f95c1353d826f83409d0e103f8965033f9e9d313f9e0ecf3f65760a3ed57a703db26e0d3e08f8bd3d6ea78d3f21428f3e65a7803f12c2df3f7b97083d6e8abb3f70af883f197a753d7b3e4e3e8096023ef760803fbde3283ccad13e409eb84f3e3ff1503e5bc0833fea91bd3e7377d93f039fe23f764e2e3d4eb4e73e65c1b03e32989b3f0a1f133d4a63833f2c8ea43fcc8a253fd84e6c3e0c59883e98b1713d3435653e22673a3e4d00eb3c7dff163fc0a1b03ed98f493f1a251f3f08d9783f83b6dc3fdf001a3f6149983e8083f33eb816643f1569023ff33dc63d5ebcb73e874a6b3e50d2873e28798f3e89764a409138da3b6a9ad63fa7f8503e14f51c3d49ca793e44015c3fbf65603eb9b2f93ec8bb8a3e1822ee3de17bfe3fd93a243fdeba0e3ef2f7553e657d8a3fa86ca53e9e64613e22a20c3e5e55af3e2eb2b03f928c323fccfec63ee880423dd2b9e63d7d602e3e2a288b3e2525a93d9abf483d0ccfaa3e7f0ff23daa57c340cef7d03d256abe3e44d32d3f1fc9703fe3874a3f847eb23f386bb73ff0dd3b3fd474bf3f085ced3d2a10b23ea25dd13f98b39e3fada5803f3257853f8f830d3fe81f9e3ebf50c33e72e6c43fe154c23fdb64ec3fb820463da1fc403e39809d3e482ed63f4d3fc83dc7cf9c3f59f4c63eb56ba23e9ab9f63ef423ba3f674a793f3f055d3d1d7c063ec4b7303ff32c5f3f0a18ca3ef87d5a3e513a1e3fec22f73c2f11263f6eefb13ed98a7e3f386e243e8cdd12406135023f32dd7e3ff9dd963d2a77393d839d6a40eabf193cda02ad3e0838433f65beab3fa68b043ed03d653f16ac483d9b43c33daf02f23ba565863e66568a3f8f3da23c4ed8ee3f5ed0223f7682693f7cece53edb2e6b3fc4ad293e829c183f2146003e6c600c40a684bf3f49e96e3dc126313fe24ec53ededa783f7823a13de7bbe83e9d39583f9f3f333e04c7613f61d4343f61a3463d66cf583f6cf0b13ee1ac463fe5d7843fb9fc353de59aeb3e509cc23e11bf7c3d447f103f9ffde43fe1dc3a3eb34a183f301e3c3f7feb453c9242683ec4c12b3e82e3133f557e6f3c2f2c443f8a1b01409042893f943d853f4e114d402ab7a23f5d09483f1d3f0f4083ef623ed61f433ea544d43e0e92fe3e38f0283fea7d033fb8288a3e0dcddf3fb78cde3e28ab2f3f84854340548b473fc758013b78449a3ef5b6803f9b65ce3f96d5603fd2928e3fe15424407479e53dff78c13f395f0440f025b73ef9b2a33e6ba2373fa51f5a3f30f1143f895eaf3efbdb283f22ae333e95d2e73f45dce33db2070a4091e91d3ef8d98e3dd9cfd03fb46e7c3e2fe8433ed15dc53e7092893fea6e853f48a48a3f2646ea3f63e98a3eb31c2d3eb722593eedc1883ed26b8e3e114d6a3dac019e3f4e9f943f1567b23f6f6a254079d3243fa5ee5b3e70fc0e3f5b894740162a873f0e14d73f625f0e3fecf84f40fc360d3f22adf73daa6cad3e30212c3f01a68a3ddae0393f3248703de8afad3dabd0e23f7949083ec86c7d3ffd2dbf3f091eb73e5f6d9c3da6b7223e6b3edb3e150c9d3e81363e3fb420be3f9de9ba3bf3dcdd3e8f99113eb9cafe3d2ceb3b3fa558ac3f7356063eb236f93e1d4cdf3ecc5db53ec4b2423ea2b5823fdb19413e4a57603f8bac1c407d57c53fe2e25b3f84399e3fbcf9973fdd93153f498da93f3c53623ffb929e3eb7a6343fd4f8f63f768dd13f885d153fcdd11440befe8a3e6ee900406d75013f95e97f3f54b4303fb37a953fda9ce23de70c3c3f747eb13e6efe913de2cf613e68a5633e19cb633f1a228f3e0c71b23eb5718e3e9d06ec3faf5c2f3e5907103f592ccb402128463fc8e2e93e6ed22e3ff61d243fef81f43f9535b03f84a22c3f86689d3fc3050a3f7d209a3e28ae033f8c62883f486c283f39a6d93d44d28a40d4cecd3d019c363fefbeaf3f7e30923eb28d033d30db343e77a3f83ed185023f18fe7f407690d53ed066213d58ad983efda3723f2b6ab83d6adee33ddea5ed3d3f87813f40cc033f48cb953fffba163eac9bca3d74c7923f262fdd3ee5080a3fc40efb3e99692d3f80573c3d9622933fa2b8aa3e186afa3f5dfda63f6b9201402212e73f6fa8033ffb78123fd70da43f07899d3cc171b13fd1f8f83a68ddf33f4d84e43db9ac8b3f1b6b1940d171503f224e153e6a9c773e31650b3f5baa283f30c2bd3b00000000623ad03f70482b3da918923f7c6cc23de80dd93fc586f33e956e743f26a0a93e61c4b03e2a787e3cd9c7bd3efbe1d73fdb3ca13e5a601f3f1fc9623e`,
  }]
