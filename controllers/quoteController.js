const { ObjectId } = require('mongodb');
const database = require('../services/database');

class QuoteController {
  /**
   * Create a new quote request.
   * Broadcasters to multiple sellers based on product activity.
   */
  async createQuote(req, res) {
    try {
      const {
        buyerId,
        buyerName,
        productName,
        requestedQuantity,
        items,
        buyerAddress,
        productId,
        sellerId,
        targetedPrice,
        deliveryDate,
        status
      } = req.body;

      if (!buyerId || !buyerName) {
        return res.status(400).json({ error: 'buyerId and buyerName are required' });
      }

      let finalItems = items || [
        {
          productId: productId,
          productName: productName,
          quantity: requestedQuantity
        }
      ];

      const quotesCollection = database.getQuotesCollection();
      const productsCollection = database.getProductsCollection();
      const usersCollection = database.getUsersCollection();

      const now = new Date();
      let matchedSellers = [];
      let broadcastStatus = null;

      if (sellerId === 'BROADCAST' || sellerId === 'MULTIPLE' || !sellerId) {
        let masterProductIds = [];
        
        for (const item of finalItems) {
          let masterProduct = null;
          if (item.productId) {
            try {
              masterProduct = await productsCollection.findOne({
                _id: new ObjectId(item.productId),
                isMaster: true
              });
            } catch (e) {
              masterProduct = await productsCollection.findOne({ name: item.productName, isMaster: true });
            }
          } else {
            masterProduct = await productsCollection.findOne({ name: item.productName, isMaster: true });
          }
          if (masterProduct) masterProductIds.push(masterProduct._id.toString());
        }

        if (masterProductIds.length > 0) {
          const sellerProducts = await productsCollection.find({
            masterProductId: { $in: masterProductIds },
            isMaster: false,
            status: 'Active'
          }).toArray();

          const uniqueSellerIds = [...new Set(sellerProducts.map(p => p.sellerId).filter(id => id))];

          for (const id of uniqueSellerIds) {
            try {
              const seller = await usersCollection.findOne({
                _id: new ObjectId(id),
                role: 'Seller'
              });
              if (seller) {
                matchedSellers.push({
                  sellerId: id,
                  sellerName: seller.name || 'Unknown Seller'
                });
              }
            } catch (err) {
              console.error(`Error fetching seller ${id}:`, err.message);
            }
          }
          broadcastStatus = matchedSellers.length > 0 ? 'BROADCASTED' : 'NO_SELLERS';
        } else {
          broadcastStatus = 'PRODUCT_NOT_FOUND';
        }
      }

      const quoteData = {
        buyerId: buyerId,
        buyerName: buyerName,
        items: finalItems,
        productName: finalItems[0].productName,
        requestedQuantity: finalItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0),
        buyerAddress: buyerAddress || null,
        sellerId: (sellerId === 'BROADCAST' || sellerId === 'MULTIPLE') ? null : sellerId,
        targetedPrice: targetedPrice || null,
        deliveryDate: deliveryDate || null,
        status: status || 'Pending',
        broadcastStatus: broadcastStatus,
        matchedSellersCount: matchedSellers.length,
        matchedSellers: matchedSellers,
        offers: [], // NEW: Initialize empty array for seller bids
        createdAt: now,
        updatedAt: now
      };

      const result = await quotesCollection.insertOne(quoteData);
      quoteData._id = result.insertedId;

      res.status(201).json({
        success: true,
        message: broadcastStatus === 'BROADCASTED'
          ? `Quote created and broadcasted to ${matchedSellers.length} seller(s)`
          : 'Quote created successfully',
        quote: quoteData
      });
    } catch (error) {
      console.error('Create quote error:', error);
      res.status(500).json({ error: 'Failed to create quote', details: error.message });
    }
  }

  /**
   * NEW: Seller submits a specific rate for a broadcasted quote.
   */
  async submitSellerOffer(req, res) {
    try {
      const { id } = req.params; // Quote ID
      const { sellerId, sellerName, offeredPrice, message } = req.body;
      const quotesCollection = database.getQuotesCollection();

      const newOffer = {
        offerId: new ObjectId(),
        sellerId: sellerId,
        sellerName: sellerName,
        offeredPrice: offeredPrice,
        message: message || "",
        status: 'Pending',
        createdAt: new Date()
      };

      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $push: { offers: newOffer },
          $set: { status: 'Quoted', updatedAt: new Date() } 
        }
      );

      if (result.matchedCount === 0) return res.status(404).json({ error: 'Quote not found' });

      res.json({ success: true, message: 'Your offer has been sent to the buyer.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit offer', details: error.message });
    }
  }

  /**
   * NEW: Buyer accepts one specific offer from the list.
   */
  async acceptSellerOffer(req, res) {
    try {
      const { id } = req.params; // Quote ID
      const { offerId, sellerId, sellerName, finalPrice } = req.body;
      const quotesCollection = database.getQuotesCollection();

      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            status: 'Accepted', 
            sellerId: sellerId, // Lock the quote to this seller
            sellerName: sellerName,
            finalPrice: finalPrice,
            acceptedOfferId: offerId,
            updatedAt: new Date() 
          } 
        }
      );

      res.json({ success: true, message: 'Offer accepted. Proceeding to payment.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to accept offer' });
    }
  }

  async getQuotesByBuyer(req, res) {
    try {
      const { buyerId } = req.params;
      const quotesCollection = database.getQuotesCollection();
      if (!quotesCollection) return res.status(500).json({ error: 'Database connection error' });

      const quotes = await quotesCollection
        .find({ buyerId: buyerId })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get quotes' });
    }
  }

  async getQuotesBySeller(req, res) {
    try {
      const { sellerId } = req.params;
      const quotesCollection = database.getQuotesCollection();
      const quotes = await quotesCollection
        .find({
          $or: [
            { sellerId: sellerId },
            {
              sellerId: null,
              'matchedSellers.sellerId': sellerId
            }
          ]
        })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get quotes' });
    }
  }

  async updateQuote(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const quotesCollection = database.getQuotesCollection();
      updateData.updatedAt = new Date();
      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Quote not found' });
      const updatedQuote = await quotesCollection.findOne({ _id: new ObjectId(id) });
      res.json({ success: true, quote: updatedQuote });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update quote' });
    }
  }
}

module.exports = new QuoteController();